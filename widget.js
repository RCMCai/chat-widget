
/**
 * RapidReply Client Widget (Updated)
 * Fixes: reliable Supabase Realtime subscribe with retry, reconnect on reload, status banner updates.
 * Assumptions:
 *  - Table: public.messagesrr(userid uuid/text, sessionid text, sender text, text text, timestamp timestamptz, read bool)
 *  - window.supabaseClient may already exist. If not, provide SUPABASE_URL and SUPABASE_ANON_KEY globals before this file.
 *  - Global tenant/company id available as RAPIDREPLY_USERID or data-attribute. Fallbacks provided.
 */

(function () {
  // -------------------- Config / Globals --------------------
  var SUPABASE_URL = window.SUPABASE_URL || null;
  var SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || null;

  // Prefer an existing instantiated client if present
  if (!window.supabaseClient) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn("[RR] No Supabase client and no keys provided. Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY before this script.");
    } else {
      // globalThis.supabase is available if the supabase-js browser bundle is loaded
      if (window.supabase) {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      } else {
        console.warn("[RR] supabase-js not found. Include @supabase/supabase-js before this script.");
      }
    }
  }

  var USERID = window.RAPIDREPLY_USERID || document.documentElement.getAttribute('data-rr-userid') || null;

  var SESSION_KEY = 'rr_session_id';
  var AGENT_MODE_KEY = 'rr_agent_mode';
  var sessionId = sessionStorage.getItem(SESSION_KEY) || null;
  var isAgentMode = sessionStorage.getItem(AGENT_MODE_KEY) === '1';
  var realtimeChannel = null;
  var subscribing = false;

  // UI hooks (fail-soft if not present)
  var chatStatus = document.querySelector('#rr-chat-status') || { innerHTML: '', textContent: '' };
  var agentBanner = document.querySelector('#rr-agent-banner') || { style: {}, textContent: '' };
  var messagesList = document.querySelector('#rr-messages');
  var inputEl = document.querySelector('#rr-input');
  var sendBtn = document.querySelector('#rr-send');

  // Helpers to add messages to UI (works even without container)
  function addMessage(text, who) {
    try {
      if (!messagesList) return;
      var li = document.createElement('div');
      li.className = who === 'agent' ? 'rr-msg rr-msg-agent' : 'rr-msg rr-msg-customer';
      li.textContent = text;
      messagesList.appendChild(li);
      messagesList.scrollTop = messagesList.scrollHeight;
    } catch (e) {}
  }

  function setStatusConnecting() {
    try {
      chatStatus.innerHTML = '<span class="rr-status-dot" style="background:#fbbf24;"></span>Connecting to agent...';
      agentBanner.style.display = 'block';
      agentBanner.textContent = 'Connecting you to a live agent...';
      agentBanner.style.background = '#FEF3C7';
      agentBanner.style.border = '1px solid #F59E0B';
      agentBanner.style.color = '#92400E';
    } catch (e) {}
  }
  function setStatusLive() {
    try {
      chatStatus.innerHTML = '<span class="rr-status-dot" style="background:#10b981;"></span>Live Agent';
      agentBanner.style.display = 'block';
      agentBanner.textContent = 'Connected to live agent';
      agentBanner.style.background = '#d1fae5';
      agentBanner.style.border = '1px solid #10b981';
      agentBanner.style.color = '#065f46';
    } catch (e) {}
  }

  // Retry util so we never miss the subscription
  function waitForSupabaseAnd(fn) {
    if (window.supabaseClient) { try { fn(); } catch (e) { console.error(e); } return; }
    setTimeout(function(){ waitForSupabaseAnd(fn); }, 120);
  }

  // -------------------- Realtime Subscribe --------------------
  function subscribeToAgentMessages() {
    if (realtimeChannel || subscribing) return;
    if (!sessionId) {
      console.warn('[RR] No sessionId yet; will retry subscribe shortly.');
      setTimeout(subscribeToAgentMessages, 250);
      return;
    }
    if (!window.supabaseClient) {
      setTimeout(subscribeToAgentMessages, 150);
      return;
    }

    subscribing = true;
    console.log('[RR] Subscribing to agent messages for session:', sessionId);

    // Before subscribing, hydrate recent messages so the UI doesn't look empty
    window.supabaseClient
      .from('messagesrr')
      .select('*')
      .eq('sessionid', sessionId)
      .order('timestamp', { ascending: true })
      .limit(100)
      .then(function(res) {
        if (res && res.data) {
          res.data.forEach(function(row){
            addMessage(row.text, row.sender);
          });
        }
      })
      .catch(function(e){ console.debug('[RR] hydrate failed', e); })
      .finally(function(){
        // Now attach realtime
        realtimeChannel = window.supabaseClient
          .channel('agent-messages-' + sessionId)
          .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'messagesrr',
              filter: 'sessionid=eq.' + sessionId
            }, function(payload) {
              var msg = payload.new || {};
              if (msg.sender === 'agent') {
                console.log('[RR] Agent message:', msg.text);
                addMessage(msg.text, 'agent');
                setStatusLive();
              }
            })
          .subscribe(function(status) {
            console.log('[RR] Realtime status:', status);
            subscribing = false;
          });
      });
  }

  // Expose for debugging
  window.RR_subscribeToAgentMessages = subscribeToAgentMessages;

  // -------------------- Handoff entrypoint --------------------
  function requestLiveAgent() {
    isAgentMode = true;
    sessionStorage.setItem(AGENT_MODE_KEY, '1');
    if (!sessionId) {
      // Generate a cheap session id if you don't already have one
      sessionId = (Date.now().toString() + '-' + Math.random().toString().slice(2));
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    setStatusConnecting();
    waitForSupabaseAnd(subscribeToAgentMessages);
  }
  window.RR_requestLiveAgent = requestLiveAgent;

  // -------------------- Send message as customer --------------------
  function sendCustomerMessage(text) {
    if (!text || !text.trim()) return;
    if (!window.supabaseClient) { console.warn('[RR] No supabase client'); return; }
    if (!sessionId) {
      sessionId = (Date.now().toString() + '-' + Math.random().toString().slice(2));
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    var row = {
      userid: USERID,
      sessionid: sessionId,
      sender: 'customer',
      text: text,
      timestamp: new Date().toISOString(),
      read: false,
    };
    addMessage(text, 'customer'); // optimistic
    window.supabaseClient.from('messagesrr').insert(row).then(function(res){
      if (res.error) console.error('[RR] insert error', res.error);
    });
  }
  window.RR_sendCustomerMessage = sendCustomerMessage;

  // -------------------- Wire send UI if present --------------------
  if (sendBtn && inputEl) {
    sendBtn.addEventListener('click', function(){
      sendCustomerMessage(inputEl.value);
      inputEl.value = '';
    });
    inputEl.addEventListener('keydown', function(e){
      if (e.key === 'Enter') {
        sendCustomerMessage(inputEl.value);
        inputEl.value='';
      }
    });
  }

  // -------------------- Auto-resubscribe on reload --------------------
  if (sessionId && isAgentMode) {
    setStatusConnecting();
    waitForSupabaseAnd(subscribeToAgentMessages);
  }

  // Optional: expose minimal API for host page
  window.RapidReplyWidget = {
    handoff: requestLiveAgent,
    send: sendCustomerMessage,
    sessionId: function(){ return sessionId; },
    isAgent: function(){ return isAgentMode; }
  };
})();
