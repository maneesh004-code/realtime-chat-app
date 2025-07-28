// Global Variables
let ws = null;
let username = '';
let messages = [];
let editingMessageId = null;
let typingTimeout = null;
let isTyping = false;

// Mock WebSocket for demo purposes
class MockWebSocket {
    constructor() {
        this.readyState = WebSocket.CONNECTING;
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        this.onerror = null;
        
        // Simulate connection
        setTimeout(() => {
            this.readyState = WebSocket.OPEN;
            if (this.onopen) this.onopen();
        }, 1000);
    }

    send(data) {
        if (this.readyState === WebSocket.OPEN) {
            // Echo back for demo - in real app, server would broadcast to all clients
            setTimeout(() => {
                if (this.onmessage) {
                    this.onmessage({ data });
                }
            }, 100);
        }
    }

    close() {
        this.readyState = WebSocket.CLOSED;
        if (this.onclose) this.onclose();
    }
}

// WebSocket Connection Management
function initWebSocket() {
    // In production, use: ws = new WebSocket('ws://localhost:8080');
    ws = new MockWebSocket();

    ws.onopen = function() {
        updateConnectionStatus(true);
        document.getElementById('onlineStatus').textContent = 'Online';
    };

    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleMessage(data);
    };

    ws.onclose = function() {
        updateConnectionStatus(false);
        document.getElementById('onlineStatus').textContent = 'Disconnected';
        
        // Attempt to reconnect
        setTimeout(initWebSocket, 3000);
    };

    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
    };
}

// Message Handling
function handleMessage(data) {
    switch(data.type) {
        case 'message':
            addMessage(data);
            break;
        case 'edit':
            editMessage(data.id, data.content);
            break;
        case 'delete':
            deleteMessage(data.id);
            break;
        case 'typing':
            showTypingIndicator(data.username);
            break;
        case 'stop_typing':
            hideTypingIndicator();
            break;
    }
}

// User Authentication
function setUsername() {
    const input = document.getElementById('usernameField');
    if (input.value.trim()) {
        username = input.value.trim();
        document.getElementById('usernameModal').style.display = 'none';
        initWebSocket();
        
        // Add welcome message
        const welcomeMsg = {
            id: Date.now(),
            username: 'System',
            content: `Welcome ${username}! 👋`,
            timestamp: new Date().toISOString(),
            isSystem: true
        };
        addMessage(welcomeMsg, false);
    }
}

// Connection Status Management
function updateConnectionStatus(connected) {
    const status = document.getElementById('connectionStatus');
    if (connected) {
        status.textContent = 'Connected';
        status.className = 'connection-status connected';
    } else {
        status.textContent = 'Disconnected';
        status.className = 'connection-status disconnected';
    }
}

// Message Sending
function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content || !ws || ws.readyState !== WebSocket.OPEN) return;

    if (editingMessageId) {
        // Edit existing message
        const message = {
            type: 'edit',
            id: editingMessageId,
            content: content,
            username: username
        };
        
        ws.send(JSON.stringify(message));
        editingMessageId = null;
        document.getElementById('sendBtn').innerHTML = '<span>➤</span>';
    } else {
        // Send new message
        const message = {
            type: 'message',
            id: Date.now(),
            username: username,
            content: content,
            timestamp: new Date().toISOString()
        };
        
        ws.send(JSON.stringify(message));
    }
    
    input.value = '';
    adjustTextareaHeight();
    stopTyping();
}

// Message Display
function addMessage(messageData, animate = true) {
    messages.push(messageData);
    
    const container = document.getElementById('messagesContainer');
    const messageEl = document.createElement('div');
    messageEl.className = `message ${messageData.username === username ? 'sent' : 'received'}`;
    messageEl.dataset.messageId = messageData.id;
    
    const isSystem = messageData.isSystem || messageData.username === 'System';
    const bubbleClass = isSystem ? 'system-message' : '';
    
    messageEl.innerHTML = `
        <div class="message-bubble ${bubbleClass}">
            ${!isSystem && messageData.username !== username ? `<div style="font-size: 0.8rem; color: #8696a0; margin-bottom: 0.25rem;">${messageData.username}</div>` : ''}
            <div class="message-content">${escapeHtml(messageData.content)}</div>
            <div class="message-time">${formatTime(messageData.timestamp)}</div>
            ${messageData.username === username && !isSystem ? `
                <div class="message-actions">
                    <button class="action-btn" onclick="startEdit('${messageData.id}')" title="Edit">✏️</button>
                    <button class="action-btn" onclick="deleteMsg('${messageData.id}')" title="Delete">🗑️</button>
                </div>
            ` : ''}
        </div>
    `;
    
    if (animate) {
        messageEl.style.opacity = '0';
        messageEl.style.transform = 'translateY(20px)';
    }
    
    container.insertBefore(messageEl, document.getElementById('typingIndicator'));
    
    if (animate) {
        setTimeout(() => {
            messageEl.style.opacity = '1';
            messageEl.style.transform = 'translateY(0)';
            messageEl.style.transition = 'all 0.3s ease';
        }, 10);
    }
    
    scrollToBottom();
}

// Message Editing
function startEdit(messageId) {
    const message = messages.find(m => m.id == messageId);
    if (!message) return;
    
    editingMessageId = messageId;
    const input = document.getElementById('messageInput');
    input.value = message.content;
    input.focus();
    
    document.getElementById('sendBtn').innerHTML = '<span>✓</span>';
    adjustTextareaHeight();
}

function editMessage(messageId, newContent) {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) {
        const contentEl = messageEl.querySelector('.message-content');
        contentEl.textContent = newContent;
        
        // Update in messages array
        const message = messages.find(m => m.id == messageId);
        if (message) {
            message.content = newContent;
        }
        
        // Add edited indicator
        const timeEl = messageEl.querySelector('.message-time');
        if (!timeEl.textContent.includes('(edited)')) {
            timeEl.textContent += ' (edited)';
        }
    }
}

// Message Deletion
function deleteMsg(messageId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'delete',
            id: messageId,
            username: username
        }));
    }
}

function deleteMessage(messageId) {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) {
        messageEl.style.opacity = '0';
        messageEl.style.transform = 'translateX(-100%)';
        setTimeout(() => {
            messageEl.remove();
        }, 300);
        
        // Remove from messages array
        messages = messages.filter(m => m.id != messageId);
    }
}

// Typing Indicators
function startTyping() {
    if (!isTyping && ws && ws.readyState === WebSocket.OPEN) {
        isTyping = true;
        ws.send(JSON.stringify({
            type: 'typing',
            username: username
        }));
    }
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(stopTyping, 3000);
}

function stopTyping() {
    if (isTyping && ws && ws.readyState === WebSocket.OPEN) {
        isTyping = false;
        ws.send(JSON.stringify({
            type: 'stop_typing',
            username: username
        }));
    }
    clearTimeout(typingTimeout);
}

function showTypingIndicator(typingUsername) {
    if (typingUsername !== username) {
        const indicator = document.getElementById('typingIndicator');
        indicator.textContent = `${typingUsername} is typing...`;
        indicator.style.display = 'block';
        scrollToBottom();
    }
}

function hideTypingIndicator() {
    document.getElementById('typingIndicator').style.display = 'none';
}

// UI Utilities
function adjustTextareaHeight() {
    const textarea = document.getElementById('messageInput');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Message input event listeners
    const messageInput = document.getElementById('messageInput');
    
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        } else if (e.key !== 'Enter') {
            startTyping();
        }
    });

    messageInput.addEventListener('input', adjustTextareaHeight);

    // Username input event listener
    document.getElementById('usernameField').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            setUsername();
        }
    });

    // Auto-focus username input
    document.getElementById('usernameField').focus();
});

// Utility Functions for Production
function connectToRealWebSocket(url) {
    // Replace MockWebSocket with real WebSocket connection
    // Example: ws = new WebSocket('ws://localhost:8080');
    ws = new WebSocket(url);
    
    ws.onopen = function() {
        updateConnectionStatus(true);
        document.getElementById('onlineStatus').textContent = 'Online';
    };

    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleMessage(data);
    };

    ws.onclose = function() {
        updateConnectionStatus(false);
        document.getElementById('onlineStatus').textContent = 'Disconnected';
        
        // Attempt to reconnect
        setTimeout(() => connectToRealWebSocket(url), 3000);
    };

    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
    };
}

// Export functions for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initWebSocket,
        sendMessage,
        setUsername,
        connectToRealWebSocket
    };
}