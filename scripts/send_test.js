// scripts/send_test.js
// Node.js script to send a test notification to verify UTF-8 character encoding on Telegram
const https = require('https');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtem9vbWVreXZsbHNncHBndnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyODg3MjcsImV4cCI6MjA4ODg2NDcyN30.TJ1BPyG8IlnxPSClIlJoOCpYUMhHHBmyL3cKFoXBJBY";
const url = "https://smzoomekyvllsgppgvxw.supabase.co/functions/v1/send-notification";

const payload = JSON.stringify({
    staff_codes: ["000142-NKH"],
    event_type: "new_btvn",
    title: "Bài tập về nhà mới",
    body: "[TEST] Học viên Nguyễn Tiến Nam vừa được giao bài tập về nhà mới: Đọc sách và làm bài tập tuần 5.",
    profile_id: "bd88348a-9971-4e50-9d89-ddeeccb3e147"
});

console.log("Sending payload via Node.js (UTF-8 assured)...");

const req = https.request(url, {
    method: 'POST',
    headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload)
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log("Response received from Supabase:");
        try {
            console.log(JSON.stringify(JSON.parse(data), null, 2));
        } catch (e) {
            console.log(data);
        }
    });
});

req.on('error', (err) => {
    console.error("Error occurred:", err);
});

req.write(payload);
req.end();
