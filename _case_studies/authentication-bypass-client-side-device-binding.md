---
layout: case_study
title: "Single Session Enforcement Bypass: A Case Study On Client-Side Enforcement"
description: "Case study on trusting client-supplied device identity for concurrent session enforcement—and how that breaks under reverse engineering."
tags:
  - Reverse Engineering
  - Application Security
  - Proxy
  - Traffic Interception
date: 2026-05-07
featured: true
series: mitm-exploit
series_order: 1
---

**Case study in trust of client-side security controls**




## Executive summary

The business incentive for account-sharing prevention is obvious. Streaming services, SaaS platforms, gaming subscriptions, VPN vendors,cruise line wifi packages, etc, rely on selling subscriptions for revenue. Sharing subscriptions with others who have not paid for the service is an attack on the business model of the service itself. This is why various methods are implemented to try and prevent concurrent sessions(IP geofencing, rate limiting, account level tracking, etc). This case study dives into a session enforcement vulnerability that was found during an audit. The case study will go over how the vulnerability was discovered, impact, and remediation. All data has been anonymized.


## Application Context

The application in question is an android TV/Mobile app(APK) that distributes digital media for an annual subscription. After a user has been authenticated and provided a JWT, a client provided deviceid is then sent to the server and stored to a database. If another person attempts to log in with the same account but through a different device, the server compares the deviceid's and kicks the first user out of their session. The intended goal here is to enforce one session at a time. This is to discourage account sharing. The application did not implement any type of enforcement via IP geofencing or rate limiting. Hence, this mechanism of checking the deviceid was the only intel the server had for enforcing 1 concurrent session.

## Vulnerability Overview
The flaw with this design is trusting client provided information. In application security, it is good practice to always treat client provided parameters as malicious or modified. This is due to how easy it is for an attacker to manipulate the client parameters via reverse engineering and/or intercepting and manipulating https traffic via a tool like burp. The deviceid provided by the client can easily be modified, allowing a user to spoof it and share their account with multiple people, bypassing session enforcement.


## Technical Analysis and exploitation
The tools needed for this exploitation are a rooted android emulator with burp, apktools for disassembling the APK into smali and rebuilding it, and optionally JADX for decompiling the APK into readable Java code.

To begin with, the application has root detection. This needs to be bypassed so that we can run the application on our rooted device with burp/mitmproxy to monitor and manipulate network traffic. Because the application does not use Google Play Integrity attestation, we can simply utilize reverse engineering to bypass this.  After disassembling the apk into editable smali using apktools, we can grep through the code base and look for where root detection is enforced and bypass it. We find this sole method responsible for root detection.

```smali
.method public static isDeviceRooted()Z
    .locals 1

    .line 1
    invoke-static {}, Lcom/sticktv/tv/util/device/RootUtil;->b()Z

    move-result v0

    if-nez v0, :cond_1

    .line 2
    invoke-static {}, Lcom/sticktv/tv/util/device/RootUtil;->c()Z

    move-result v0

    if-nez v0, :cond_1

    .line 3
    invoke-static {}, Lcom/sticktv/tv/util/device/RootUtil;->d()Z

    move-result v0

    if-nez v0, :cond_1

    .line 4
    invoke-static {}, Lcom/sticktv/tv/util/device/RootUtil;->e()Z

    move-result v0

    if-nez v0, :cond_1

    .line 5
    invoke-static {}, Lcom/sticktv/tv/util/device/RootUtil;->a()Z

    move-result v0

    if-eqz v0, :cond_0

    goto :goto_0

    :cond_0
    const/4 v0, 0x0

    goto :goto_1

    :cond_1
    :goto_0
    const/4 v0, 0x1

    :goto_1
    return v0
.end method
```

Now the method can simply be rewritten as:

```smali
.method public static isDeviceRooted()Z
    
    return v0
.end method
```

Now that this simple root detection has been bypassed,it is now time to sign and install modified client into our rooted device and we are ready to begin exploitation.

(It is important to note that there are various ways to make root detection bypass much more difficult which can slow down an attacker such as using play integrity attestation, native code, server side anomaly scoring etc. Even then, anything ran on a attacker controlled device can eventually be hooked or bypassed. This is why in Application security, it is good practice to always assume the client is compromised.)

Exact parameter values have been anonymized.

This JSON payload is sent to the server during authentication:

```json
{"appVersion":"1.0.2","cbn":"","cfv":"","chak":"","chsi":"","creditAmount":6,"csak":"","dateExpire":"25/10/2026","description":"","detachDevices":false,"deviceId":"75c09bb7-aa3a-4a3c-9c92-de721b066aeb","fullName":"user name","id":"68d599741a0b23cafba698ea","ivit":"","kidp":"","model":"Phone","name":"username","password":"102030","product":"vbox86p","refId":"1234","role":"app","sdkVersion":"27"}
```

The important part of the JSON payload to pay attention to is the deviceId field. Now the behavior of the app is that if another user has an active session but with another deviceId, the server responds with:

```json
{"message":"User assigned to another device. Are you sure you want to unlink the device? You will need to sign in again."}
```

If the user clicks OK, the previous users session is ended and our current user can now start their session. Their deviceiD now replaces the previous deviceId in the database.


Now lets grep through the client and see which method is responsible for returning the deviceId. We find this smali method:

```smali
.method public static getId(Landroid/content/Context;)Ljava/lang/String;
    .locals 3

    const-string v0, ""

    .line 1
    :try_start_0
    sget v1, Landroid/os/Build$VERSION;->SDK_INT:I

    const/16 v2, 0x1c

    if-ge v1, v2, :cond_2

    .line 2
    new-instance v1, Lcom/sticktv/domain/preference/SessionPrefs;

    invoke-direct {v1, p0}, Lcom/sticktv/domain/preference/SessionPrefs;-><init>(Landroid/content/Context;)V

    .line 3
    invoke-virtual {v1}, Lcom/sticktv/domain/preference/SessionPrefs;->getDeviceId()Ljava/lang/String;

    move-result-object p0

    if-eqz p0, :cond_0

    .line 4
    invoke-virtual {p0, v0}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z

    move-result v2

    if-eqz v2, :cond_1

    .line 5
    :cond_0
    invoke-static {}, Ljava/util/UUID;->randomUUID()Ljava/util/UUID;

    move-result-object p0

    invoke-virtual {p0}, Ljava/util/UUID;->toString()Ljava/lang/String;

    move-result-object p0

    .line 6
    invoke-virtual {v1, p0}, Lcom/sticktv/domain/preference/SessionPrefs;->setDeviceId(Ljava/lang/String;)V

    .line 7
    invoke-virtual {v1}, Lcom/sticktv/domain/preference/SessionPrefs;->save()Z

    :cond_1
    return-object p0

    .line 8
    :cond_2
    invoke-virtual {p0}, Landroid/content/Context;->getApplicationContext()Landroid/content/Context;

    move-result-object p0

    invoke-virtual {p0}, Landroid/content/Context;->getContentResolver()Landroid/content/ContentResolver;

    move-result-object p0

    const-string v1, "android_id"

    .line 9
    invoke-static {p0, v1}, Landroid/provider/Settings$Secure;->getString(Landroid/content/ContentResolver;Ljava/lang/String;)Ljava/lang/String;

    move-result-object p0
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0

    return-object p0

    :catch_0
    return-object v0
.end method
```

Again, now all a malicious actor has to do is patch it like so:

```smali
.method public static getId(Landroid/content/Context;)Ljava/lang/String;
    .locals 1
    const-string v0, "abc"
    return-object v0
.end method
```

and after building and signing, their new patched client now returns the same hardcoded deviceId regardless of which device is running the client:

```json
{"appVersion":"1.0.2","cbn":"","cfv":"","chak":"","chsi":"","creditAmount":6,"csak":"","dateExpire":"25/10/2026","description":"","detachDevices":false,"deviceId":"abc","fullName":"user name","id":"68d599741a0b23cafba698ea","ivit":"","kidp":"","model":"Phone","name":"username","password":"102030","product":"vbox86p","refId":"1234","role":"app","sdkVersion":"27"}
```




## Business Impact
What was achieved here and why would this matter to the victim? Now, this patched client can be distributed to others, and each device using this patched client will send the same deviceId to the server. Concurrent session restriction has comepletely been bypassed now that the server has no way of telling one device from another. This directly impacts the victim’s subscription-revenue model. If this method were to leak online, multiple people could take advantage of this bypass leading to significant revenue loss for the victim company. 

Most bug bounty programs and audits would consider this a low impact vulnerability. Some companies even consider this an acceptable side affect due to relying on only client side session enforcement. However, a skilled attacker can chain this vulnerability with other technologies to scale the exploitation by directly siphoning revenue from the company themselves, turning this otherwise low impact vulnerability into high impact fast. See [Reverse Proxy MITM: Escalating Weak Session Enforcement to Critical]({{ '/case-studies/reverse-proxy-mitm-demonstration/' | relative_url }}).

## Remediation
 

 A potential solution to this is implementing google play attestation. This would make using patched/modified clients impossible and thus, users would be forced to use a sincere client when sending request to the server. However it is important to note that while attestation helps, this is not a fullproof solution. An advanced attacker can still set up a proxy inbetween the real client, manipulating payloads in real time(such as sending a static deviceId). If multiple people are ralying through the same proxy, again they can trick the server into thinking that they are all one device.

A more full proof solution to this is playback/session entitlement monitoring enforced server-side. Enforcing session not just during log in but also when media is consumed itself. The backend should always be the final authority and validate every time it issues playback manifest, stream tokens, or media licenses. This active server side monitoring can check if for example, the same user is trying to watch 2 different videos at the same time.



## Conclusion

This case study shows the flaw of relying on client provided information. The server should always have the final say when it comes to enforcement. Proper concurrent session restriction is an ongoing issue that many industries are constantly trying to solve as exploiters are proactively coming up with better methods of bypassing them. Even though some companies accept the consequences that come with client side session enforcement, if not paired with some type of server side session monitoring, a skilled attacker can scale this vulnerability up to a high severity one. See [Reverse Proxy MITM: Escalating Weak Session Enforcement to Critical]({{ '/case-studies/reverse-proxy-mitm-demonstration/' | relative_url }}).

