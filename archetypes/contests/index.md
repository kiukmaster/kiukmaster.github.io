---
title: {{ replace .File.ContentBaseName "-" " " | jsonify }}
date: "{{ (time.In "Asia/Seoul" time.Now).Format "2006-01-02T15:04:05Z07:00" }}"
description: ""
draft: true
---

