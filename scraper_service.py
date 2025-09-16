# FastAPI + Playwright (dinâmico) + BeautifulSoup (estático)
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List
import asyncio, re
from bs4 import BeautifulSoup
import httpx
from playwright.async_api import async_playwright

app = FastAPI()

class ScrapeIn(BaseModel):
    url: HttpUrl

class ScrapeOut(BaseModel):
    title: str | None
    images: List[str]

async def fetch_html(url):
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as c:
        r = await c.get(str(url), headers={"User-Agent":"Mozilla/5.0"})
        r.raise_for_status()
        return r.text

def parse_images_from_html(html, base):
    soup = BeautifulSoup(html, "html.parser")
    imgs = []
    for tag in soup.select("img[src]"):
        src = tag.get("src") or ""
        if src.startswith("//"): src = "https:" + src
        imgs.append(httpx.URL(src, base=str(base)).join(src).human_repr())
    title = (soup.title.string.strip() if soup.title and soup.title.string else None)
    # limpa duplicatas e coisas pequenas (thumbnails)
    imgs = [u for i,u in enumerate(imgs) if u and imgs.index(u) == i]
    return title, imgs

async def dynamic_scrape(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(str(url), wait_until="networkidle")
        # carrega lazy images
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(1500)
        html = await page.content()
        await browser.close()
    return html

@app.post("/extract", response_model=ScrapeOut)
async def extract(in_: ScrapeIn):
    try:
        # tenta estático primeiro
        html = await fetch_html(in_.url)
        title, imgs = parse_images_from_html(html, in_.url)
        if len(imgs) < 3:
            # cai pra dinâmico
            html = await dynamic_scrape(in_.url)
            title, imgs = parse_images_from_html(html, in_.url)
        # filtra por extensões comuns
        imgs = [u for u in imgs if re.search(r'\.(jpg|jpeg|png|webp)(\?|$)', u, re.I)]
        return ScrapeOut(title=title, images=imgs[:15])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
