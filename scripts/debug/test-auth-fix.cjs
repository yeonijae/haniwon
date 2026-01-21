const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false, args: ['--auto-open-devtools-for-tabs'] });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`BROWSER: ${msg.text()}`);
  });

  // 1. 포털 접속 및 로그인
  console.log('1. Navigating to portal...');
  await page.goto('http://localhost:5170');
  await page.waitForSelector('input[type="text"]', { timeout: 10000 });

  // 로그인
  await page.type('input[type="text"]', 'admin');
  await page.type('input[type="password"]', '7582');
  await page.click('button[type="submit"]');

  console.log('2. Waiting for login...');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  // portal_session 확인
  const portalSession = await page.evaluate(() => {
    return localStorage.getItem('portal_session');
  });
  console.log('portal_session:', portalSession);

  // 3. 채팅 페이지로 이동
  console.log('3. Navigating to chat...');
  await page.goto('http://localhost:5170/chat');

  // 5초 대기
  await new Promise(r => setTimeout(r, 5000));

  // chat-auth-storage 확인
  const chatAuthStorage = await page.evaluate(() => {
    return localStorage.getItem('haniwon-chat-auth');
  });
  console.log('chat-auth-storage:', chatAuthStorage);

  // isAuthenticated 확인
  if (chatAuthStorage) {
    const parsed = JSON.parse(chatAuthStorage);
    console.log('isAuthenticated:', parsed.state?.isAuthenticated);
    console.log('user:', JSON.stringify(parsed.state?.user, null, 2));
  }

  // 페이지 내용 확인
  const pageContent = await page.evaluate(() => {
    return document.body.innerText.substring(0, 500);
  });
  console.log('Page content preview:', pageContent.substring(0, 200));

  console.log('\nTest complete. Keeping browser open for 30 seconds...');
  await new Promise(r => setTimeout(r, 30000));

  await browser.close();
})();
