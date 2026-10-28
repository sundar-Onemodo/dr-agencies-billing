const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const htmlPath = path.resolve(__dirname, '../app_documentation.html');
const outputPath = path.resolve(__dirname, '../DR_Agencies_App_Documentation.pdf');
const artifactPath = 'C:\\Users\\mohan\\.gemini\\antigravity-ide\\brain\\217a8e95-8aff-416c-a0e3-e110c0a17254\\DR_Agencies_App_Documentation.pdf';

async function generatePdf() {
  console.log('Starting Chrome in headless mode with remote debugging...');
  const port = 9222;
  const tempDir = 'C:\\Users\\mohan\\AppData\\Local\\Temp\\chrome_pdf_cdp';
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const chromeProcess = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempDir}`
  ]);

  // Wait for Chrome version endpoint
  let versionInfo = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      versionInfo = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(e);
            }
          });
        }).on('error', reject);
      });
      if (versionInfo && versionInfo.webSocketDebuggerUrl) break;
    } catch (e) {
      // Keep waiting
    }
  }

  if (!versionInfo || !versionInfo.webSocketDebuggerUrl) {
    chromeProcess.kill();
    throw new Error('Could not connect to Chrome browser websocket.');
  }

  const browserWsUrl = versionInfo.webSocketDebuggerUrl;
  console.log('Connected to Browser WebSocket:', browserWsUrl);

  const ws = new WebSocket(browserWsUrl);
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  let msgId = 1;
  function sendCommand(method, params = {}, sessionId = undefined) {
    const id = msgId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;

    return new Promise((resolve, reject) => {
      const handler = (data) => {
        try {
          const res = JSON.parse(data.toString());
          if (res.id === id) {
            ws.off('message', handler);
            if (res.error) {
              reject(new Error(JSON.stringify(res.error)));
            } else {
              resolve(res.result);
            }
          }
        } catch (err) {
          // ignore
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify(payload));
    });
  }

  const htmlUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
  console.log('Creating target for:', htmlUrl);
  const { targetId } = await sendCommand('Target.createTarget', { url: htmlUrl });
  console.log('Target created:', targetId);

  const { sessionId } = await sendCommand('Target.attachToTarget', { targetId, flatten: true });
  console.log('Attached with sessionId:', sessionId);

  await sendCommand('Page.enable', {}, sessionId);
  await new Promise((r) => setTimeout(r, 1200)); // wait for rendering and fonts

  console.log('Executing Page.printToPDF...');
  const pdfResult = await sendCommand('Page.printToPDF', {
    printBackground: true,
    paperWidth: 8.27, // A4
    paperHeight: 11.69,
    marginTop: 0.2,
    marginBottom: 0.2,
    marginLeft: 0.2,
    marginRight: 0.2,
    preferCSSPageSize: true,
  }, sessionId);

  const pdfBuffer = Buffer.from(pdfResult.data, 'base64');
  fs.writeFileSync(outputPath, pdfBuffer);
  console.log('PDF written successfully to:', outputPath, `(${pdfBuffer.length} bytes)`);

  try {
    fs.writeFileSync(artifactPath, pdfBuffer);
    console.log('PDF written to artifact directory:', artifactPath);
  } catch (err) {
    console.warn('Artifact write error:', err);
  }

  await sendCommand('Target.closeTarget', { targetId });
  ws.close();
  chromeProcess.kill();
  console.log('PDF generation successfully completed!');
}

generatePdf().catch(err => {
  console.error('PDF Generation Error:', err);
  process.exit(1);
});
