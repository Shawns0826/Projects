---
layout: case_study
title: "RBAC Admin Panel: Hierarchical Subtree Authorization"
description: "A wholesale-to-consumer admin panel with subtree-scoped RBAC, credit delegation, session hardening, bootstrap secrets, and audit logging."
tags:
  - Application Security
  - RBAC
  - Web Security
  - Authorization
date: 2026-05-23
series: mitm-exploit
series_order: 3
---

This admin panel demonstration is meant to replicate a secure mass digital media access token distribution environment from the wholesale level all the way to the consumer level. The roles are root administrator, admin, reseller, and customer.

The platform implements a hierarchical subtree-based RBAC model. The subtree structure enforces rules that prevent horizontal and vertical escalation. Access credits are minted by privileged administrative roles and propagated through delegated reseller relationships. Resellers and end-user accounts are restricted from minting credits and may only receive delegated allocations. Resellers have the ability to send credits to others.

Each user is a node in the subtree and can only manage users under their local tree, with the root administrator at the top. This prevents a user from managing another user that is not under their subtree, preventing horizontal escalation.

![Subtree hierarchy and role relationships]({{ "/assets/images/rbac-admin-panel-hierarchy.png" | relative_url }})

The `User` model stores `role` and `parent_id` / `children` relationships that define the tree. Subtree authorization is enforced in `can_manage_user()` and `is_in_hierarchy()`:

```python
# models.py (lines 76–106)
def can_manage_user(self, target_user):
    """Check if this user can manage the target user based on role hierarchy"""
    if self.role == 'rootadmin':
        return True  # Root admin can manage everyone
    elif self.role == 'admin':
        return self.is_in_hierarchy(target_user) and target_user.role in ['reseller', 'customer']
    elif self.role == 'reseller':
        return self.is_in_hierarchy(target_user) and target_user.role in ['reseller', 'customer']
    return False

def is_in_hierarchy(self, target_user):
    """Check if target_user is anywhere in the hierarchy under this user"""
    if target_user.id == self.id:
        return False
    if target_user.parent_id == self.id:
        return True
    for child in self.children:
        if child.id == target_user.id:
            return True
        if child.is_in_hierarchy(target_user):
            return True
    return False
```

The panel lists only users the viewer may manage via `users_visible_in_panel()`, which filters descendants through `can_manage_user()` (root admin sees everyone).

## Root admin bootstrap

To create the tree securely, we utilize environment variables during bootstrapping to create the root admin (`ROOTADMIN_BOOTSTRAP_USERNAME`, `ROOTADMIN_BOOTSTRAP_PASSWORD`, `ROOTADMIN_CREATE_TOKEN`). Credentials are not hardcoded so a leaked codebase does not expose production secrets. In development only, a default password may exist for convenience.

The bootstrap HTTP endpoint is gated in production by a constant-time token comparison:

```python
# routes.py (~1184–1208)
@app.route('/create-rootadmin', methods=['POST'])
def create_root_admin_endpoint():
    if os.environ.get("FLASK_ENV") == "production":
        token = (config.ROOTADMIN_CREATE_TOKEN or "").strip()
        supplied = (request.headers.get("X-Bootstrap-Token") or "").strip()
        if len(supplied) != len(token) or not hmac.compare_digest(
            supplied.encode("utf-8"), token.encode("utf-8")
        ):
            return jsonify({"success": False, "message": "Forbidden"}), 403
```

Session cookies use `HttpOnly`, `SameSite=Lax`, and `Secure` when `FLASK_ENV` is `production` (configured in `config.py` and applied in `app.py`). That reduces session theft via XSS and CSRF when deployed correctly. When deploying, set `FLASK_ENV=production` on the server so HTTPS-only cookies and other production settings apply—not development mode, where traffic may be cleartext.

## Route protection

Any sensitive action such as deleting users or moving credits requires secure enforcement. We use `@login_required` for authentication, `@require_role` for role allowlists, and `can_manage_user(target)` before acting on another user. Forgetting any of these checks can allow horizontal or vertical privilege escalation in the panel.

```python
# security.py (lines 119–150)
def require_role(required_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from flask_login import current_user
            if not current_user.is_authenticated:
                return jsonify({
                    "success": False,
                    "message": "Authentication required"
                }), 401
            if isinstance(required_roles, str):
                allowed_roles = [required_roles]
            else:
                allowed_roles = required_roles
            if current_user.role not in allowed_roles:
                return jsonify({
                    "success": False,
                    "message": "Insufficient permissions"
                }), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator
```

Typical panel routes stack decorators and re-check subtree scope on destructive actions—for example, deleting a user:

```python
# routes.py (~1825–1839)
@app.route('/panel/users/<username>/delete', methods=['POST'])
@login_required
@require_role(['rootadmin', 'admin', 'reseller'])
def panel_delete_user(username):
    user = User.query.filter_by(username=username).first()
    # ...
    if not current_user.can_manage_user(user):
        flash('Insufficient permissions', 'error')
        return redirect(url_for('panel_users'))
```

## Moving credits

Credit transfers and balance changes are guarded by `can_manage_user()` and additional role checks so non-administrators cannot mint or arbitrarily edit credits. User-update handlers reject credit edits from non-admins and restrict role changes to root admin only.

```python
# routes.py (~991–1021)
@app.route('/extend-credits', methods=['POST'])
@login_required
def extend_credits():
    data = request.get_json()
    username = data.get('username')
    credits_to_add = data.get('credits', 1)
    target_user = User.query.filter_by(username=username).first()
    if not target_user:
        return jsonify({"success": False, "message": "User not found"}), 404
    if not current_user.can_manage_user(target_user):
        return jsonify({
            "success": False,
            "message": "You don't have permission to extend credits for this user"
        }), 403
    if current_user.role not in ['rootadmin', 'admin']:
        if current_user.credits_int < credits_to_add:
            return jsonify({
                "success": False,
                "message": f"Insufficient credits. You have {current_user.credits_int} credits, need {credits_to_add}"
            }), 400
    # ... transfer credits, log TRANSFER / EXTEND ...
```

## Audit trails

Audit trails allow administrators to review prior actions and detect abuse. The panel logs authentication outcomes, admin actions, and credit adjustments with timestamp, IP, and contextual details for incident review. For stronger assurance against database tampering, consider HMAC or hash chains over log entries.

`log_security_event()` persists rows to `SecurityAuditLog` and is called at sensitive points (login, user creation, credit changes):

```python
# security.py (~152–186); routes.py (~298–310) at login
def log_security_event(event_type, user_id=None, details=None, ip_address=None, severity='INFO'):
    audit_log = SecurityAuditLog(
        event_type=event_type,
        user_id=user_id,
        ip_address=ip_address,
        user_agent=user_agent,
        details=details,
        severity=severity
    )
    db.session.add(audit_log)
    db.session.commit()

# Example: LOGIN_SUCCESS after successful authentication
log_security_event(
    event_type="LOGIN_SUCCESS",
    user_id=user.id,
    ip_address=request.remote_addr,
    details=f"Login successful for user {username}"
)
```

## Threat model

Because this system handles role-based hierarchies and credit transfers, the main security concern should be in preventing horizontal/vertical privilege escalation as well as credit abuse/manipulation. During development this requires looking out for things such as the following:

- Horizontal escalation via managing users not under your subtree
- Vertical escalation via improper authorization enforcement, insecure administrator endpoints, etc.
- Non-admin users able to mint, forge, or duplicate credits due to improper server-side enforcement
- Unauthorized credit balance manipulation through API interaction

This is not a list of all the exploits we need to look out for but rather exploits that are specific to our admin panel environment. For a more comprehensive security audit, a full penetration test engagement is required. Mitigations of the exploits outlined involve subtree-scope authorization checks, role validation decorators, HttpOnly/SameSite cookie protections, and audit logging with before/after balance tracking.
