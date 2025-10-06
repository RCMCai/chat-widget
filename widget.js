// Rapid Reply Chat Widget - Final Version
(function() {
    'use strict';

    var config = window.RAPID_REPLY_CONFIG || {};
    var userId = config.userId;
    var webhookUrl = config.webhookUrl || 'https://n8n.ie-manage.com/webhook/live-chat';

    if (!userId) {
        console.error('ERROR: userId not found. Set window.RAPID_REPLY_CONFIG before loading widget.js');
        return;
    }

    console.log('Widget initialized with userId:', userId);

    var SUPABASE_URL = 'https://vwlqgwavzdohqkfaxgpt.supabase.co';
    var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3bHFnd2F2emRvaHFrZmF4Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3ODQ3MjksImV4cCI6MjA2NzM2MDcyOX0.LfAbG47R8ohZApapG2HUxprqA-vj3wZeovl7mIv1O_I';

    var SESSION_STORAGE_KEY = 'chatSessionId';
    var sessionId = null;
    var isAgentMode = false;
    var conversationHistory = [];
    var clientEmail = '';
    var clientPhone = '';
    var clientName = '';
    var businessHours = null;
    var canTransferToAgent = false;
    var realtimeChannel = null;

    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = function() {
        if (typeof supabase !== 'undefined') {
            window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase loaded');
        }
    };
    document.head.appendChild(script);

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://rcmcai.github.io/chat-widget/widget.css';
    document.head.appendChild(link);

    var widgetDiv = document.createElement('div');
    widgetDiv.innerHTML = `
        <button id="rr-chat-button" aria-label="Open chat">
            <svg viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
        </button>

        <div id="rr-chat-widget">
            <div class="rr-chat-header">
                <div class="rr-chat-header-top">
                    <div class="rr-chat-header-title">
                        <div class="rr-chat-avatar">
                            <span>RR</span>
                        </div>
                        <div class="rr-chat-header-text">
                            <h3>Support</h3>
                            <p id="rr-chat-status"><span class="rr-status-dot"></span>Online now</p>
                        </div>
                    </div>
                    <button class="rr-close-button" id="rr-close-chat">&times;</button>
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

            <div id="rr-agent-banner" style="display: none;"></div>

            <div class="rr-chat-messages" id="rr-chat-messages" style="display: none;"></div>
            
            <div class="rr-chat-input" id="rr-chat-input" style="display: none;">
                <div class="rr-input-wrapper">
                    <input type="text" id="rr-message-input" placeholder="Type your message...">
                    <button class="rr-send-button" id="rr-send-button">
                        <svg viewBox="0 0 24 24">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(widgetDiv);

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

    chatButton.addEventListener('click', function() {
        chatWidget.classList.add('rr-open');
        chatButton.style.display = 'none';
        
        var savedSessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (savedSessionId) {
            sessionId = savedSessionId;
            showChatInterface();
        }
    });

    closeChat.addEventListener('click', function() {
        chatWidget.classList.remove('rr-open');
        chatButton.style.display = 'flex';
        if (realtimeChannel) {
            realtimeChannel.unsubscribe();
            realtimeChannel = null;
        }
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
            if (!response.ok) throw new Error('Server error');
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
                throw new Error('No session ID');
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
        chatMessages.style.display = 'flex';
        chatInput.style.display = 'block';
        messageInput.focus();
    }

    function addMessage(text, sender) {
        var messageDiv = document.createElement('div');
        messageDiv.className = 'rr-message rr-' + sender;
        messageDiv.textContent = text;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        conversationHistory.push({
            text: text,
            sender: sender,
            timestamp: new Date().toISOString()
        });
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
                    console.error('Error:', error);
                    sendButton.disabled = false;
                    messageInput.disabled = false;
                });
        } else {
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
                addMessage('Sorry, something went wrong.', 'bot');
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
        if (!canTransferToAgent) return;
        
        console.log('=== HANDOFF ===');
        console.log('userId:', userId);
        console.log('sessionId:', sessionId);
        
        isAgentMode = true;
        agentBanner.style.display = 'block';
        agentBanner.textContent = 'Connecting you to a live agent...';
        chatStatus.innerHTML = '<span class="rr-status-dot" style="background: #fbbf24;"></span>Connecting...';

        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'handoff',
                userId: userId,
                sessionId: sessionId,
                clientName: clientName,
                clientEmail: clientEmail,
                clientPhone: clientPhone,
                conversationHistory: conversationHistory,
                timestamp: Date.now(),
                status: 'open'
            })
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            console.log('Handoff complete:', data);
            addMessage('An agent will be with you shortly...', 'bot');
            subscribeToAgentMessages();
        })
        .catch(function(error) {
            console.error('Handoff error:', error);
            addMessage('Could not connect to agent.', 'bot');
            isAgentMode = false;
            agentBanner.style.display = 'none';
        });
    }

    function subscribeToAgentMessages() {
        if (!window.supabaseClient || realtimeChannel) return;

        console.log('Subscribing to messages for session:', sessionId);

        realtimeChannel = window.supabaseClient
            .channel('agent-' + sessionId)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messagesrr',
                    filter: 'sessionid=eq.' + sessionId
                },
                function(payload) {
                    console.log('Message received:', payload);
                    var msg = payload.new;
                    if (msg.sender === 'agent') {
                        addMessage(msg.text, 'agent');
                        
                        chatStatus.innerHTML = '<span class="rr-status-dot" style="background: #10b981;"></span>Live Agent';
                        agentBanner.textContent = 'Connected to live agent';
                        agentBanner.style.background = '#d1fae5';
                        agentBanner.style.color = '#065f46';
                    }
                }
            )
            .subscribe();
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
})();
