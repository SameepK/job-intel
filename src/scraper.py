import asyncio
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from src.tools import check_sponsorship_signal, detect_ats_type


async def scrape_page(url: str) -> dict:
    """
    Scrape any job page using Playwright.
    Returns raw text + metadata.
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            await page.goto(url, wait_until="networkidle", timeout=30000)
            title = await page.title()
            content = await page.content()
        except Exception as e:
            await browser.close()
            return {
                "url": url,
                "title": "",
                "text": "",
                "error": str(e)
            }

        await browser.close()

    # Parse with BeautifulSoup
    soup = BeautifulSoup(content, "html.parser")

    # Remove noise
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    # Get clean text
    text = soup.get_text(separator="\n")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    clean_text = "\n".join(lines)

    return {
        "url": url,
        "title": title,
        "text": clean_text[:8000],
        "sponsorship_signal": check_sponsorship_signal(clean_text),
        "ats_type": detect_ats_type(url),
        "error": None
    }


async def scrape_multiple(urls: list) -> list:
    """Scrape multiple job pages concurrently."""
    tasks = [scrape_page(url) for url in urls]
    return await asyncio.gather(*tasks)


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        url = sys.argv[1]
        result = asyncio.run(scrape_page(url))
        print(f"Title: {result['title']}")
        print(f"ATS: {result['ats_type']}")
        print(f"Sponsorship: {result['sponsorship_signal']}")
        print(f"Text preview:\n{result['text'][:500]}")