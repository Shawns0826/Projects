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

The user model stores role and parent/child relationships that define the tree:

```python
# models.py (lines 24–25, 38–39)
role = db.Column(db.String(20), nullable=False, default='customer')  # rootadmin, admin, reseller, customer
parent_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
children = db.relationship('User', backref=db.backref('parent', remote_side=[id]))
```

Subtree authorization is enforced in `can_manage_user()` and `is_in_hierarchy()`:

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

The panel only lists users the viewer is allowed to manage:

```python
# routes.py (~142–162)
def users_visible_in_panel(viewer: User) -> list:
    if viewer.role == "rootadmin":
        return User.query.order_by(User.username).all()
    desc_ids = _descendant_user_ids(viewer.id)
    candidates = User.query.filter(User.id.in_(desc_ids)).order_by(User.username).all()
    return [u for u in candidates if viewer.can_manage_user(u)]
```

## Root admin bootstrap

To create the tree securely, we utilize environment variables during bootstrapping to create the root admin. Root admin credentials are implemented through env variables rather than being hard coded into the code itself. This action is done to prevent root admin credentials from being exposed in the off chance that the code base is leaked. Any other sensitive information should never be exposed in the code base and should be utilized by env variables. In our panel, hardcoded root admin credentials are stored only in development mode for convenience.

```python
# config.py (lines 46–48)
ROOTADMIN_BOOTSTRAP_USERNAME = (os.environ.get("ROOTADMIN_BOOTSTRAP_USERNAME") or "rootadmin").strip()
ROOTADMIN_BOOTSTRAP_PASSWORD = os.environ.get("ROOTADMIN_BOOTSTRAP_PASSWORD")
ROOTADMIN_CREATE_TOKEN = os.environ.get("ROOTADMIN_CREATE_TOKEN")
```

```python
# routes.py — create_root_admin() (~73–111)
raw_pw = (config.ROOTADMIN_BOOTSTRAP_PASSWORD or _DEFAULT_ROOTADMIN_PASSWORD).strip()
username = (config.ROOTADMIN_BOOTSTRAP_USERNAME or "rootadmin").strip() or "rootadmin"
# ...
rootadmin = User(username=username, role="rootadmin", credits=999999)
rootadmin.set_password(raw_pw)
```

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

It is essential we have other security features turned on such as HttpOnly cookies to prevent session theft in the unfortunate case that an attacker can find an XSS vulnerability, as well as SameSite = Lax to prevent CSRF. When deploying, we need to make sure we have an env variable set to `production` on our server so that we deploy properly. The existence of the `production` env variable will ensure that we deploy with the most secure settings as opposed to deploying in development mode, where HTTPS is turned off and all traffic is in clear text.

```python
# config.py (lines 14–17)
class Config:
    PERMANENT_SESSION_LIFETIME = timedelta(hours=24)
    SESSION_COOKIE_SECURE = os.environ.get('FLASK_ENV') == 'production'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
```

```python
# app.py (lines 16–19)
app.config["SESSION_COOKIE_SECURE"] = config.current_config.SESSION_COOKIE_SECURE
app.config["SESSION_COOKIE_HTTPONLY"] = config.current_config.SESSION_COOKIE_HTTPONLY
app.config["SESSION_COOKIE_SAMESITE"] = config.current_config.SESSION_COOKIE_SAMESITE
```

Successful login establishes a persistent session:

```python
# routes.py (~310)
login_user(user, remember=True)
```

## Route protection

Any sensitive action such as deleting users or moving credits requires secure enforcement. We have a `@login_required` wrapper to ensure that the user has valid authentication, as well as a `@require_role` wrapper and `can_manage_user(target)` checks to ensure that the user has proper authorization to perform the action. Forgetting to implement these security measures can allow various types of horizontal and vertical privilege escalation in the admin panel.

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

Panel routes combine authentication and role checks:

```python
# routes.py (panel routes ~1250+)
@app.route('/panel')
@login_required
@require_role(['rootadmin', 'admin', 'reseller'])
def panel_dashboard():
    """Main dashboard for the web panel"""
    managed_users = users_visible_in_panel(current_user)
    # ...
```

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

Credit transfers and balance changes are guarded by `can_manage_user()` and additional role checks so non-administrators cannot mint or arbitrarily edit credits.

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

User update endpoints enforce the same subtree scope and restrict credit/role edits by role:

```python
# routes.py (~1518–1555)
if not current_user.can_manage_user(user):
    return jsonify({"success": False, "message": "Insufficient permissions"}), 403
if 'credits' in data and current_user.role in ['rootadmin', 'admin']:
    # manual credit adjustment ...
elif 'credits' in data and current_user.role not in ['rootadmin', 'admin']:
    return jsonify({"success": False, "message": "Only administrators can edit user credits"}), 403
if 'role' in data and current_user.role == 'rootadmin':
  # only root admin may change roles ...
```

## Audit trails

Audit trails allow administrators the ability to view previous actions and ensure nothing malicious has happened. This panel audits authentication failures, admin actions, and credit adjustments with timestamp, IP, and before/after balances for proper incident review and abuse detection. For extra security, it is recommended to include some type of cryptographic enforcement in the case that a malicious actor obtains database write access. This would prevent anyone from being able to tamper with audit logs. Cryptographic enforcement can be achieved using tools such as HMAC or hash chains.

```python
# models.py (~182–191)
class SecurityAuditLog(db.Model):
    event_type = db.Column(db.String(50), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=True)
    ip_address = db.Column(db.String(45), nullable=False)
    user_agent = db.Column(db.String(500), nullable=True)
    details = db.Column(db.Text, nullable=True)
    severity = db.Column(db.String(20), default='INFO')
```

```python
# security.py (~152–186)
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
```

Login and user creation are logged at the point of action:

```python
# routes.py (~298–310)
log_security_event(
    event_type="LOGIN_SUCCESS",
    user_id=user.id,
    ip_address=request.remote_addr,
    details=f"Login successful for user {username}"
)
login_user(user, remember=True)
```

```python
# routes.py (~1717–1721)
log_security_event(
    event_type="USER_CREATED",
    user_id=current_user.id,
    details=f"Created user {username} (role: {role}) with {credits} credits"
)
```

## Threat model

Because this system handles role-based hierarchies and credit transfers, the main security concern should be in preventing horizontal/vertical privilege escalation as well as credit abuse/manipulation. During development this requires looking out for things such as the following:

- Horizontal escalation via managing users not under your subtree
- Vertical escalation via improper authorization enforcement, insecure administrator endpoints, etc.
- Non-admin users able to mint, forge, or duplicate credits due to improper server-side enforcement
- Unauthorized credit balance manipulation through API interaction

This is not a list of all the exploits we need to look out for but rather exploits that are specific to our admin panel environment. For a more comprehensive security audit, a full penetration test engagement is required. Mitigations of the exploits outlined involve subtree-scope authorization checks, role validation decorators, HttpOnly/SameSite cookie protections, and audit logging with before/after balance tracking.
