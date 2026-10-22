---
title: "뉴스 크롤링 사이트 제작 by Codex"
date: "2026-09-22T18:00:00+09:00"
description: "Gemini API를 활용하여 뉴스 사이트들에서 기사를 크롤링 해서 요약 보여주는 웹 사이트입니다."
categories: []
tags: []
url: "/posts/p2/"
draft: false
---

## Gemini API를 활용, AI · 보안 뉴스 크롤링 프로젝트 {#section-one}

## 작동원리 {#section-two}

**Gemini API**를 활용하여 기사들의 내용을 3.5-flash-lite 모델을 사용하여 요약하고,<br> 3.8 Flash 모델을 이용해 "HOT 10"을 임의로 선정.

Output과 기사 내용들을 더해 최종 보고서를 작성합니다.

최종 보고서는 보고서 목록 페이지 <br>[https://kiukmaster.github.io/kiuk_news](https://kiukmaster.github.io/kiuk_news)

## 호스팅 및 실행주기 {#section-2}

Github Pages와 Actions를 활용하여 매일 06시 13시 19시에 한번씩 기사를 크롤링·Gemini API를 호출합니다.

크롤링 할 때 마다 새로운 보고서를 생성하지 않고 당일 날짜에 생성된 보고서가 있으면 해당 보고서에 추가로 기사가 삽입됩니다.

기사를 가져온 사이트는 아래 표를 참고해주세요.

<table style="width: 100%; max-width: 400px; background-color: #000000; color: #ffffff; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px;">
  <thead>
    <tr style="border-bottom: 1px solid #222;">
      <th style="text-align: left; padding: 12px 16px; font-weight: 600;">분야</th>
      <th style="text-align: left; padding: 12px 16px; font-weight: 600;">사이트</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="padding: 10px 16px;">AI</td><td style="padding: 10px 16px;"><a href="https://www.aitimes.com" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline dotted #666; text-underline-offset: 4px;">AI타임스 ↗</a></td></tr>
    <tr><td style="padding: 10px 16px;">AI</td><td style="padding: 10px 16px;"><a href="https://openai.com" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline dotted #666; text-underline-offset: 4px;">OpenAI ↗</a></td></tr>
    <tr><td style="padding: 10px 16px;">AI</td><td style="padding: 10px 16px;"><a href="https://ai.google" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline dotted #666; text-underline-offset: 4px;">Google AI ↗</a></td></tr>
    <tr><td style="padding: 10px 16px;">AI</td><td style="padding: 10px 16px;"><a href="https://huggingface.co" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline dotted #666; text-underline-offset: 4px;">Hugging Face ↗</a></td></tr>
    <tr><td style="padding: 10px 16px;">보안</td><td style="padding: 10px 16px;"><a href="https://www.dailysecu.com" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline dotted #666; text-underline-offset: 4px;">데일리시큐 ↗</a></td></tr>
    <tr><td style="padding: 10px 16px;">보안</td><td style="padding: 10px 16px;"><a href="https://www.boannews.com" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline dotted #666; text-underline-offset: 4px;">보안뉴스 ↗</a></td></tr>
    <tr><td style="padding: 10px 16px;">보안</td><td style="padding: 10px 16px;"><a href="https://thehackernews.com" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline dotted #666; text-underline-offset: 4px;">The Hacker News ↗</a></td></tr>
    <tr><td style="padding: 10px 16px;">보안</td><td style="padding: 10px 16px;"><a href="https://www.bleepingcomputer.com" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline dotted #666; text-underline-offset: 4px;">BleepingComputer ↗</a></td></tr>
    <tr><td style="padding: 10px 16px;">보안</td><td style="padding: 10px 16px;"><a href="https://www.securityweek.com" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline dotted #666; text-underline-offset: 4px;">SecurityWeek ↗</a></td></tr>
    <tr><td style="padding: 10px 16px;">보안</td><td style="padding: 10px 16px;"><a href="https://krebsonsecurity.com" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline dotted #666; text-underline-offset: 4px;">Krebs on Security ↗</a></td></tr>
    <tr><td style="padding: 10px 16px;">신기술·논문</td><td style="padding: 10px 16px;"><a href="https://www.etnews.com" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline dotted #666; text-underline-offset: 4px;">전자신문 ↗</a></td></tr>
    <tr><td style="padding: 10px 16px;">신기술·논문</td><td style="padding: 10px 16px;"><a href="https://news.hada.io" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline dotted #666; text-underline-offset: 4px;">GeekNews ↗</a></td></tr>
    <tr><td style="padding: 10px 16px;">신기술·논문</td><td style="padding: 10px 16px;"><a href="https://arxiv.org/list/cs.AI/recent" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline dotted #666; text-underline-offset: 4px;">arXiv AI ↗</a></td></tr>
    <tr><td style="padding: 10px 16px;">신기술·논문</td><td style="padding: 10px 16px;"><a href="https://arxiv.org/list/cs.CR/recent" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline dotted #666; text-underline-offset: 4px;">arXiv 보안 ↗</a></td></tr>
    <tr><td style="padding: 10px 16px;">인기</td><td style="padding: 10px 16px;"><a href="https://github.com/trending" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline dotted #666; text-underline-offset: 4px;">GitHub Trending ↗</a></td></tr>
    <tr><td style="padding: 10px 16px;">CVE</td><td style="padding: 10px 16px;"><a href="https://nvd.nist.gov" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline dotted #666; text-underline-offset: 4px;">NVD ↗</a></td></tr>
    <tr><td style="padding: 10px 16px;">CVE</td><td style="padding: 10px 16px;"><a href="https://www.cve.org" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline dotted #666; text-underline-offset: 4px;">공식 CVE List ↗</a></td></tr>
  </tbody>
</table>
