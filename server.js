const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = 3000;

const { exec } = require('child_process');

const activeStreams = new Map(); // Stores username -> stream URL

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/video', express.static(path.join(__dirname, 'video'), {
    setHeaders: (res) => {
        res.set('Cache-Control', 'no-store'); // Prevent caching of video files
    }
}));

//API 
app.post('/start-stream', express.json(), (req, res) => {
    const { username, url } = req.body;
    
    if (!username || !url) {
        return res.status(400).send('Username and URL required');
    }

    // Execute Python script with the URL
    console.log(`Running: python3 videoStream.py "${url}"`); // Log the exact command
    exec(`python3 getvideo.py "${url}"`, (error, stdout, stderr) => 
    {
        console.log('stdout:', stdout); // Python script output
        console.log('stderr:', stderr); // Python errors
        if (error) {
            console.error('Exec error:', error);
        }
        console.log(`Python script output: ${stdout}`);
        res.send('Stream started successfully');
        
        // Broadcast to all clients
        broadcast({
            type: 'user-streaming',
            username,
            url
        });
    });
});

app.get('/api/videos', (req, res) => {
    const fs = require('fs');
    const videoDir = path.join(__dirname, 'video');
    
    fs.readdir(videoDir, (err, files) => {
        if (err || !files.length) {
            const status = err ? 500 : 404;
            const error = err ? 'Directory read error' : 'No video file found';
            console.error(error, err);
            return res.status(status).json({ error });
        }
        
        res.json({ video: encodeURIComponent(files[0]) });
    });
});

// Create HTTP server
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });
const users = new Map(); // ws -> { username, page }

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'set-username') {
            users.set(ws, { username: data.username, page: 'index.html' });
            console.log(`[+] ${data.username} connected`);
            broadcastUserList();
        }

        if (data.type === 'get-user-list') {
            const userList = Array.from(users.values());
            ws.send(JSON.stringify({
                type: 'user-list',
                users: userList
            }));
        }

        if (data.type === 'navigation') {
            const user = users.get(ws) || {};
            users.set(ws, { username: data.username, page: data.page });
            console.log(`[+] ${data.username} connected`);
            console.log(` L @ ${data.page}`);
            broadcastUserList();
        }

        if (data.type === 'sync-time') {
        // Broadcast the current video time to all viewers (except the sender)
            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'sync-update',
                        username: data.username,
                        time: data.time
                    }));
                }
            });
        }

        if (data.type === 'video-pause') {
            // Forward to all other clients
            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'video-pause',
                        username: data.username
                    }));
                }
            });
        }

        if (data.type === 'video-play') {
            // Forward to all other clients
            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'video-play',
                        username: data.username
                    }));
                }
            });
        }
    });

    ws.on('close', () => {
        const user = users.get(ws);
        if (user && user.username) {
            console.log(`[-] ${user.username} disconnected`);
        }
        users.delete(ws);
        broadcastUserList();

                // If no users left, trigger cleanup
        if (users.size === 0) {
            console.log('[🧹] No active users. Clearing video folder...');
            exec('python3 cleanup.py', (error, stdout, stderr) => {
                if (error) {
                    console.error('Cleanup error:', error);
                }
                console.log('stdout:', stdout);
                console.error('stderr:', stderr);
            });
        }        
    });
});

function broadcastUserList() {
    const userList = Array.from(users.values());
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'user-list',
                users: userList
            }));
        }
    });
}

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

app.get('/', (req, res) => {
    res.redirect('/static/index.html');
});