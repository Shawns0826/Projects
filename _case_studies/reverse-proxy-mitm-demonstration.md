---
layout: case_study
title: "Reverse Proxy MITM: Escalating Weak Session Enforcement to Critical"
description: "How a reverse-engineered client plus a reverse proxy can turn low-severity session bypass into unauthorized monetization of upstream media—distinct from classic phishing MITM."
tags:
  - Reverse Engineering
  - Application Security
  - Android Security
  - Traffic Interception
  - Exploit Chaining
date: 2026-05-10
series: mitm-exploit
series_order: 2
---

It is common in the industry that the ability to bypass client-side session enforcement is ranked low severity. In this paper, we will demonstrate how a capable attacker can take this otherwise low-severity vulnerability and escalate it to a critical one through reverse engineering and proxying.

This project demonstrates how a malicious actor can siphon revenue from an upstream service through transparent reverse-proxy brokering. In this example, our target is a digital media Android TV/mobile app (APK). Although similar, this attack is not to be confused with phishing, in which an attacker sets up a MITM (man-in-the-middle) proxy through a similar-looking domain (changing `outlook.com/login` to `outlook.co/login`) and waits for users to land on their fake website, authenticates, then finally steals their session. In this attack, a MITM proxy is also used, but instead of stealing sessions, the goal is to use a reverse proxy to transparently broker access to the victim service itself.

Everything present in the demonstration has been anonymized.

The proxy presents itself as a standalone service that independently handles registration, authentication, and session management while secretly relaying upstream requests to the upstream target application when specific content is requested. In this attack, the legitimate platform becomes an invisible backend content provider for the attacker rather than the primary user-facing service. This enables unauthorized monetization of proxied access to the upstream platform.

![High-level view of the reverse-proxy broker model]({{ "/assets/images/mitm-reverse-proxy-overview.png" | relative_url }})

Although rare, this specific attack has been known to happen.

Any app that has weak concurrent session restrictions and no attestation enforcement is susceptible to this attack. This specific demonstration builds off the [previous case study]({{ '/case-studies/authentication-bypass-client-side-device-binding/' | relative_url }}), in which we did a case study on a weak concurrent session restriction found during an audit. Now that we can have one session being used by multiple people, let’s see exactly how a capable attacker can implement this attack.

Through reverse engineering, an attacker has full control over the client. We assume they would disassemble the app using Apktool and grep for `url`. The following method would be discovered.

```

    const-string v0, "https://original-server-url.com/"

```

An attacker can modify the client such that they change the server URL that the client normally points to, to their own server like this.

```

    const-string v0, "https://attacker-url.com/"

```

The attacker would build and sign the app. Now they have the same client as the original app; the only difference is that HTTP(S) requests will now be sent to an attacker-controlled proxy server instead of the original service.

Nothing else about the client needs to change—in fact it is more convenient for the attacker to leave the client as is. Now they would map every endpoint the client requests, and ensure they intercept any that involve authorization or authentication. The attacker would set up their own custom logic for dealing with authorization or authentication. This involves validating usernames and passwords, assigning session tokens, registering accounts, and so on. Anything else, such as fetching media, is upstreamed to the victim server and then returned to the user. This lets the attacker monetize access to the victim’s resources.

![Request flow: attacker-facing auth vs upstreamed content]({{ "/assets/images/mitm-reverse-proxy-flow.png" | relative_url }})

A low-severity vulnerability has successfully been escalated to critical. The attacker has successfully monetized another application’s resources, and neither their users nor the legitimate service is aware of what is truly going on behind (or in-between) the scenes. This can lead to disastrous consequences over time if the legitimate service is not quick to take action.
