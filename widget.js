// Rapid Reply Chat Widget - Supabase Realtime Version
(function() {
    'use strict';

    var config = window.RAPID_REPLY_CONFIG || {};
    var userId = config.userId;
    var webhookUrl = config.webhookUrl || 'https://n8n.ie-manage.com/webhook/live-chat';
    var theme = config.theme || 'blue';
    var logoUrl = config.logoUrl || '';
    var companyInitials = config.companyInitials || 'RR';
    var companyName = config.companyName || 'Support';

    console.log('Widget initialized with userId:', userId);
    console.log('Config:', config);

    // Supabase config
    var SUPABASE_URL = 'https://vwlqgwavzdohqkfaxgpt.supabase.co';
    var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3bHFnd2F2emRvaHFrZmF4Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3ODQ3MjksImV4cCI6MjA2NzM2MDcyOX0.LfAbG47R8ohZApapG2HUxprqA-vj3wZeovl7mIv1O_I';

    var SESSION_STORAGE_KEY = 'chatSessionId';
    var AGENT_MODE_KEY = 'chatAgentMode';
    var sessionId = null;
    var isTyping = false;
    var isAgentMode = false;
    var conversationHistory = [];
    var clientEmail = '';
    var clientPhone = '';
    var clientName = '';
    var businessHours = null;
    var canTransferToAgent = false;
    var realtimeChannel = null;

    // Load Supabase dynamically
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = function() {
        if (typeof supabase !== 'undefined') {
            window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase loaded successfully');
        }
    };
    document.head.appendChild(script);
    // Wait helper to ensure Supabase client is ready before subscribing
    function waitForSupabaseAnd(fn) {
        if (window.supabaseClient) { try { fn(); } catch(e){ console.error(e);} return; }
        setTimeout(function(){ waitForSupabaseAnd(fn); }, 100);
    }


    var html = `
        <style>
            * {
                box-sizing: border-box;
            }

            #rr-chat-button {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999999;
                transition: transform 0.2s;
            }

            #rr-chat-button:hover {
                transform: scale(1.1);
            }

            #rr-chat-button svg {
                width: 28px;
                height: 28px;
                fill: white;
            }

            #rr-chat-button img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
            }

            #rr-chat-widget {
                position: fixed;
                bottom: 90px;
                right: 20px;
                width: 400px;
                height: 650px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                display: none;
                flex-direction: column;
                z-index: 999998;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
            }

            #rr-chat-widget.rr-open {
                display: flex;
            }

            .rr-chat-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 12px 12px 0 0;
            }

            .rr-chat-header-top {
                padding: 16px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .rr-chat-header-title {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .rr-chat-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: rgba(255,255,255,0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 16px;
            }

            .rr-chat-avatar img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
            }

            .rr-chat-header-text h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }

            .rr-chat-header-text p {
                margin: 4px 0 0 0;
                font-size: 12px;
                opacity: 0.9;
            }

            .rr-status-dot {
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #10b981;
                margin-right: 6px;
            }

            .rr-close-button {
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .rr-contact-form {
                padding: 30px;
                display: flex;
                flex-direction: column;
                overflow-y: auto;
                max-height: calc(100% - 80px);
            }

            .rr-contact-form h4 {
                margin: 0 0 8px 0;
                font-size: 20px;
                color: #1f2937;
            }

            .rr-contact-form > div:first-child p {
                margin: 0 0 24px 0;
                color: #6b7280;
                font-size: 14px;
            }

            .rr-form-group {
                margin-bottom: 16px;
            }

            .rr-form-group label {
                display: block;
                margin-bottom: 6px;
                font-size: 14px;
                font-weight: 500;
                color: #374151;
            }

            .rr-form-group input {
                width: 100%;
                padding: 10px 14px;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                font-size: 14px;
                outline: none;
                transition: border-color 0.2s;
            }

            .rr-form-group input:focus {
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }

            .rr-error-message {
                color: #ef4444;
                font-size: 13px;
                margin: 8px 0;
                min-height: 20px;
            }

            .rr-contact-form button {
                width: 100%;
                padding: 12px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s;
                margin-top: 8px;
            }

            .rr-contact-form button:hover {
                transform: translateY(-1px);
            }

            .rr-contact-form button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .rr-chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                background: #f9fafb;
                display: none;
            }

            .rr-message {
                margin-bottom: 16px;
                display: flex;
            }

            .rr-message.rr-user {
                justify-content: flex-end;
            }

            .rr-message.rr-bot, .rr-message.rr-agent {
                justify-content: flex-start;
            }

            .rr-message > div {
                max-width: 70%;
                padding: 10px 14px;
                border-radius: 12px;
                font-size: 14px;
                line-height: 1.4;
            }

            .rr-message.rr-user > div {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 12px 12px 0 12px;
            }

            .rr-message.rr-bot > div {
                background: white;
                color: #1f2937;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                border-radius: 12px 12px 12px 0;
            }

            .rr-message.rr-agent > div {
                background: #dbeafe;
                color: #1e40af;
                border-radius: 12px 12px 12px 0;
            }

            .rr-typing-indicator {
                display: flex;
                gap: 4px;
                padding: 8px;
            }

            .rr-typing-indicator span {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #9ca3af;
                animation: typing 1.4s infinite;
            }

            .rr-typing-indicator span:nth-child(2) {
                animation-delay: 0.2s;
            }

            .rr-typing-indicator span:nth-child(3) {
                animation-delay: 0.4s;
            }

            @keyframes typing {
                0%, 60%, 100% { transform: translateY(0); }
                30% { transform: translateY(-8px); }
            }

            .rr-chat-input {
                padding: 16px 20px;
                border-top: 1px solid #e5e7eb;
                background: white;
                border-radius: 0 0 12px 12px;
                display: none;
            }

            .rr-input-wrapper {
                display: flex;
                gap: 8px;
            }

            .rr-input-wrapper input {
                flex: 1;
                padding: 10px 14px;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                font-size: 14px;
                outline: none;
            }

            .rr-input-wrapper input:focus {
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }

            .rr-send-button {
                padding: 10px 16px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                border-radius: 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .rr-send-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .rr-send-button svg {
                width: 20px;
                height: 20px;
                fill: white;
            }

            #rr-agent-banner {
                display: none;
                background: #fef3c7;
                border-bottom: 1px solid #fbbf24;
                padding: 10px;
                text-align: center;
                font-size: 13px;
                color: #92400e;
            }

            @media (max-width: 480px) {
                #rr-chat-widget {
                    width: 100%;
                    height: 100%;
                    bottom: 0;
                    right: 0;
                    border-radius: 0;
                }
            }
        </style>

        <button id="rr-chat-button" aria-label="Open chat">
            <svg viewBox="0 0 24 24" id="rr-default-icon">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
        </button>

        <div id="rr-chat-widget" class="rr-theme-${theme}">
            <div class="rr-chat-header">
                <div class="rr-chat-header-top">
                    <div class="rr-chat-header-title">
                        <div class="rr-chat-avatar" id="rr-header-avatar">
                            <span id="rr-avatar-initials">${companyInitials}</span>
                        </div>
                        <div class="rr-chat-header-text">
                            <h3>${companyName}</h3>
                            <p id="rr-chat-status"><span class="rr-status-dot"></span>Online now</p>
                        </div>
                    </div>
                    <button class="rr-close-button" id="rr-close-chat" aria-label="Close chat">&times;</button>
                </div>
                <div id="rr-powered-by" style="text-align: center; padding: 8px; font-size: 11px; color: rgba(255,255,255,0.7); border-top: 1px solid rgba(255,255,255,0.1);">
                    Powered by RapidReply
                </div>
            </div>

            <div class="rr-contact-form" id="rr-contact-form">
                <div>
                    <h4>Welcome!</h4>
                    <p>Let's get started with your information</p>
                </div>
                <div class="rr-form-group">
                    <label for="rr-name-input">Full Name</label>
                    <input type="text" id="rr-name-input" placeholder="John Doe" required>
                </div>
                <div class="rr-form-group">
                    <label for="rr-email-input">Email address</label>
                    <input type="email" id="rr-email-input" placeholder="you@example.com" required>
                </div>
                <div class="rr-form-group">
                    <label for="rr-phone-input">Phone number</label>
                    <input type="tel" id="rr-phone-input" placeholder="+1 (555) 000-0000" required>
                </div>
                <div class="rr-error-message" id="rr-error-message"></div>
                <button id="rr-start-chat">Start Conversation</button>
            </div>

            <div id="rr-agent-banner"></div>

            <div class="rr-chat-messages" id="rr-chat-messages"></div>
            
            <div class="rr-chat-input" id="rr-chat-input">
                <div class="rr-input-wrapper">
                    <input type="text" id="rr-message-input" placeholder="Type your message...">
                    <button class="rr-send-button" id="rr-send-button" aria-label="Send message">
                        <svg viewBox="0 0 24 24">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    var chatButton = document.getElementById('rr-chat-button');
    var chatWidget = document.getElementById('rr-chat-widget');
    var closeChat = document.getElementById('rr-close-chat');
    var contactForm = document.getElementById('rr-contact-form');
    var nameInput = document.getElementById('rr-name-input');
    var emailInput = document.getElementById('rr-email-input');
    var phoneInput = document.getElementById('rr-phone-input');
    var startChatBtn = document.getElementById('rr-start-chat');
    var errorMessage = document.getElementById('rr-error-message');
    var chatMessages = document.getElementById('rr-chat-messages');
    var chatInput = document.getElementById('rr-chat-input');
    var messageInput = document.getElementById('rr-message-input');
    var sendButton = document.getElementById('rr-send-button');
    var agentBanner = document.getElementById('rr-agent-banner');
    var chatStatus = document.getElementById('rr-chat-status');

    if (logoUrl) {
        var buttonImg = document.createElement('img');
        buttonImg.src = logoUrl;
        buttonImg.alt = 'Chat';
        document.getElementById('rr-default-icon').style.display = 'none';
        chatButton.appendChild(buttonImg);

        var headerImg = document.createElement('img');
        headerImg.src = logoUrl;
        headerImg.alt = companyName;
        document.getElementById('rr-avatar-initials').style.display = 'none';
        document.getElementById('rr-header-avatar').appendChild(headerImg);
    }

    chatButton.addEventListener('click', function() {
        chatWidget.classList.add('rr-open');
        chatButton.style.display = 'none';
        
        var savedSessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (savedSessionId) {
            sessionId = savedSessionId;
            var wasAgent = false; try { wasAgent = sessionStorage.getItem(AGENT_MODE_KEY) === '1'; } catch(e) {}
            if (wasAgent) { agentBanner.style.display='block'; agentBanner.textContent='Reconnecting to live agent...'; chatStatus.innerHTML='<span class="rr-status-dot" style="background: #fbbf24;"></span>Connecting to agent...'; waitForSupabaseAnd(function(){ subscribeToAgentMessages(); }); }
            showChatInterface();
        }
    });

    closeChat.addEventListener('click', function() {
        chatWidget.classList.remove('rr-open');
        chatButton.style.display = 'flex';
        stopRealtimeSubscription();
    });

    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function validatePhone(phone) {
        return /^[\d\s\-\+\(\)]+$/.test(phone) && phone.replace(/\D/g, '').length >= 10;
    }

    function checkBusinessHours() {
        if (!businessHours) return true;
        
        var now = new Date();
        var currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        var currentTime = now.getHours() * 60 + now.getMinutes();
        
        var todayHours = businessHours[currentDay];
        if (!todayHours || todayHours.closed) return false;
        
        var startParts = todayHours.start.split(':');
        var endParts = todayHours.end.split(':');
        var startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
        var endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
        
        return currentTime >= startMinutes && currentTime <= endMinutes;
    }

    startChatBtn.addEventListener('click', function() {
        var name = nameInput.value.trim();
        var email = emailInput.value.trim();
        var phone = phoneInput.value.trim();

        errorMessage.textContent = '';

        if (!name) {
            errorMessage.textContent = 'Please enter your name';
            return;
        }

        if (!validateEmail(email)) {
            errorMessage.textContent = 'Please enter a valid email address';
            return;
        }

        if (!validatePhone(phone)) {
            errorMessage.textContent = 'Please enter a valid phone number';
            return;
        }

        clientName = name;
        clientEmail = email;
        clientPhone = phone;

        startChatBtn.disabled = true;
        startChatBtn.textContent = 'Connecting...';

        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'initialize',
                name: name,
                email: email,
                phone: phone,
                userId: userId,
                timestamp: Date.now()
            })
        })
        .then(function(response) {
            if (!response.ok) {
                throw new Error('Server responded with ' + response.status);
            }
            return response.json();
        })
        .then(function(data) {
            if (data.sessionId) {
                sessionId = data.sessionId;
                sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
                
                if (data.businessHours) {
                    businessHours = data.businessHours;
                    canTransferToAgent = checkBusinessHours();
                }
                
                showChatInterface();
                
                if (data.welcomeMessage) {
                    addMessage(data.welcomeMessage, 'bot');
                }
            } else {
                throw new Error('No session ID received');
            }
        })
        .catch(function(error) {
            console.error('Error:', error);
            errorMessage.textContent = 'Unable to connect. Please try again.';
            startChatBtn.disabled = false;
            startChatBtn.textContent = 'Start Conversation';
        });
    });

    function showChatInterface() {
        contactForm.style.display = 'none';
        chatMessages.style.display = 'block';
        chatInput.style.display = 'block';
        messageInput.focus();
    }

    function addMessage(text, sender) {
        var messageDiv = document.createElement('div');
        messageDiv.className = 'rr-message rr-' + sender;
        
        if (sender === 'agent') {
            var labelDiv = document.createElement('div');
            labelDiv.style.fontSize = '10px';
            labelDiv.style.fontWeight = 'bold';
            labelDiv.style.marginBottom = '4px';
            labelDiv.style.opacity = '0.9';
            labelDiv.textContent = 'LIVE AGENT';
            
            var contentDiv = document.createElement('div');
            contentDiv.appendChild(labelDiv);
            contentDiv.appendChild(document.createTextNode(text));
            messageDiv.appendChild(contentDiv);
        } else {
            var textDiv = document.createElement('div');
            textDiv.textContent = text;
            messageDiv.appendChild(textDiv);
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        conversationHistory.push({
            text: text,
            sender: sender,
            timestamp: new Date().toISOString()
        });
    }

    function showTyping() {
        if (isTyping) return;
        isTyping = true;
        
        var typingDiv = document.createElement('div');
        typingDiv.className = 'rr-message rr-bot rr-typing';
        typingDiv.id = 'rr-typing-indicator';
        typingDiv.innerHTML = '<div class="rr-typing-indicator"><span></span><span></span><span></span></div>';
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function hideTyping() {
        isTyping = false;
        var typingDiv = document.getElementById('rr-typing-indicator');
        if (typingDiv) typingDiv.remove();
    }

    function sendMessage() {
        var message = messageInput.value.trim();
        if (!message || !sessionId) return;

        addMessage(message, 'user');
        messageInput.value = '';
        sendButton.disabled = true;
        messageInput.disabled = true;

        if (isAgentMode) {
            if (!window.supabaseClient) {
                console.error('Supabase not loaded');
                sendButton.disabled = false;
                messageInput.disabled = false;
                return;
            }

            window.supabaseClient
                .from('messagesrr')
                .insert({
                    userid: userId,
                    sessionid: sessionId,
                    sender: 'customer',
                    text: message,
                    timestamp: new Date().toISOString(),
                    read: false
                })
                .then(function() {
                    sendButton.disabled = false;
                    messageInput.disabled = false;
                    messageInput.focus();
                })
                .catch(function(error) {
                    console.error('Error sending message:', error);
                    sendButton.disabled = false;
                    messageInput.disabled = false;
                });
        } else {
            showTyping();
            
            fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'message',
                    sessionId: sessionId,
                    message: message,
                    userId: userId,
                    agentMode: false,
                    clientName: clientName,
                    clientEmail: clientEmail,
                    clientPhone: clientPhone,
                    timestamp: Date.now()
                })
            })
            .then(function(response) { return response.json(); })
            .then(function(data) {
                hideTyping();
                
                if (data.reply) {
                    addMessage(data.reply, 'bot');
                }
                
                if (data.triggerHandoff === true) {
                    if (canTransferToAgent) {
                        requestLiveAgent();
                    }
                }
            })
            .catch(function(error) {
                console.error('Error:', error);
                hideTyping();
                addMessage('Sorry, something went wrong. Please try again.', 'bot');
            })
            .finally(function() {
                sendButton.disabled = false;
                messageInput.disabled = false;
                messageInput.focus();
            });
        }
    }

    function requestLiveAgent() {
        if (isAgentMode) return;
        
        if (!canTransferToAgent) {
            return;
        }
        
        console.log('=== HANDOFF DEBUG ===');
        console.log('userId:', userId);
        console.log('sessionId:', sessionId);
        console.log('clientName:', clientName);
        console.log('clientEmail:', clientEmail);
        console.log('clientPhone:', clientPhone);
        console.log('conversationHistory length:', conversationHistory.length);
        
        isAgentMode = true;
        try{ sessionStorage.setItem(AGENT_MODE_KEY, '1'); }catch(e){}
        agentBanner.style.display = 'block';
        agentBanner.textContent = 'Connecting you to a live agent...';
        chatStatus.innerHTML = '<span class="rr-status-dot" style="background: #fbbf24;"></span>Connecting to agent...';

        var payload = {
            action: 'handoff',
            userId: userId,
            sessionId: sessionId,
            clientName: clientName,
            clientEmail: clientEmail,
            clientPhone: clientPhone,
            conversationHistory: conversationHistory,
            timestamp: Date.now(),
            status: 'open'
        };
        
        console.log('Sending payload:', JSON.stringify(payload, null, 2));

        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function(response) {
            console.log('Handoff response status:', response.status);
            return response.json();
        })
        .then(function(data) {
            console.log('Handoff response data:', data);
            addMessage('An agent will be with you shortly...', 'bot');
            waitForSupabaseAnd(function(){ subscribeToAgentMessages(); });
        })
        .catch(function(error) {
            console.error('Error requesting agent:', error);
            addMessage('Could not connect to agent. Please try again.', 'bot');
            isAgentMode = false;
            agentBanner.style.display = 'none';
            chatStatus.innerHTML = '<span class="rr-status-dot"></span>Online now';
        });
    }

    function subscribeToAgentMessages() {
        if (realtimeChannel) return;
        if (!window.supabaseClient) { setTimeout(subscribeToAgentMessages, 150); return; }

        console.log('Subscribing to agent messages for session:', sessionId);

        realtimeChannel = window.supabaseClient
            .channel('agent-messages-' + sessionId)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messagesrr',
                    filter: 'sessionid=eq.' + sessionId
                },
                function(payload) {
                    console.log('Received message:', payload);
                    var msg = payload.new;
                    if (msg.sender === 'agent') {
                        addMessage(msg.text, 'agent');
                        
                        if (chatStatus.textContent.includes('Connecting')) {
                            chatStatus.innerHTML = '<span class="rr-status-dot" style="background: #10b981;"></span>Live Agent';
                            agentBanner.textContent = 'Connected to live agent';
                            agentBanner.style.background = '#d1fae5';
                            agentBanner.style.borderColor = '#10b981';
                            agentBanner.style.color = '#065f46';
                        }
                    }
                }
            )
            .subscribe();
    }

    function stopRealtimeSubscription() {
        if (realtimeChannel) {
            realtimeChannel.unsubscribe();
            realtimeChannel = null;
        }
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
})();
