const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();

  try {
    // CS 수납 페이지로 이동
    await page.goto('http://localhost:5170/cs', { waitUntil: 'networkidle2' });

    // 로그인이 필요하면 기다림
    await page.waitForSelector('.receipt-list, .login-form', { timeout: 10000 });

    // 타임라인 날짜 헤더들 확인
    await page.waitForSelector('.timeline-date', { timeout: 10000 });

    const dates = await page.$$eval('.timeline-date', els =>
      els.map(el => el.textContent.trim())
    );

    console.log('=== 타임라인 날짜 순서 ===');
    dates.forEach((date, i) => {
      console.log(`${i + 1}. ${date}`);
    });

    // 날짜 정렬 확인
    const isDescending = dates.every((date, i) => {
      if (i === 0) return true;
      // 날짜 파싱 (YY/MM/DD 형식)
      const parse = d => {
        const clean = d.replace(' 오늘', '');
        const [y, m, dd] = clean.split('/');
        const year = parseInt(y) < 50 ? 2000 + parseInt(y) : 1900 + parseInt(y);
        return new Date(year, parseInt(m) - 1, parseInt(dd));
      };
      const prev = parse(dates[i - 1]);
      const curr = parse(date);
      return prev >= curr;
    });

    console.log('\n정렬 상태:', isDescending ? '✅ 최신순 (내림차순)' : '❌ 정렬 안 됨');

  } catch (error) {
    console.error('오류:', error.message);
  }

  // 10초 대기 후 종료 (확인용)
  await new Promise(r => setTimeout(r, 10000));
  await browser.close();
})();
