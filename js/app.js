/**
 * TaskFlow v2.3 - Premium Task Manager
 * Complete rewrite with robust voice input, premium UI, and full feature set
 */

(function() {
  'use strict';

  // ==========================================
  // CONFIG
  // ==========================================
  const CONFIG = {
    VERSION: '2.3.0',
    STORAGE_KEY: '***',
    FOCUS_DEFAULT: 25,
    FOCUS_OPTIONS: [15, 25, 45, 60],
    VOICE_TIMEOUT: 30000, // 30 seconds max listening time
    DEBOUNCE_DELAY: 500
  };

  // ==========================================
  // STATE
  // ==========================================
  let state = {
    tasks: [],
    deleted: [],
    filter: 'all',
    darkMode: true,
    focusTask: null,
    focusDuration: CONFIG.FOCUS_DEFAULT,
    focusTimeLeft: 0,
    focusInterval: null,
    editingTask: null,
    isLoading: true
  };

  // Voice state (separate to avoid conflicts)
  let voiceState = {
    recognition: null,
    isListening: false,
    transcript: '',
    interimTranscript: '',
    isProcessing: false,
    timeoutId: null
  };

  // ==========================================
  // STORAGE
  // ==========================================
  function loadData() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        state.tasks = data.tasks || [];
        state.deleted = data.deleted || [];
        state.darkMode = data.darkMode !== false;
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    }
    applyTheme();
  }

  function saveData() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({
        tasks: state.tasks,
        deleted: state.deleted,
        darkMode: state.darkMode
      }));
    } catch (e) {
      console.error('Failed to save data:', e);
    }
  }

  // ==========================================
  // THEME
  // ==========================================
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : 'light');
  }

  function toggleTheme() {
    state.darkMode = !state.darkMode;
    applyTheme();
    saveData();
  }

  // ==========================================
  // UTILS
  // ==========================================
  function $(id) { return document.getElementById(id); }
  function uuid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 9); }
  
  function formatDate(d) {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === date.toDateString();
    if (isToday) return 'Today ' + date.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'});
    if (isTomorrow) return 'Tomorrow ' + date.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'});
    return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
  }
  
  function isOverdue(d) {
    if (!d) return false;
    const due = new Date(d);
    const now = new Date();
    return due < now && due.toDateString() !== now.toDateString();
  }
  
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function vibrate(pattern) {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // ==========================================
  // LOADING SCREEN
  // ==========================================
  function hideLoadingScreen() {
    const loading = $('loading-screen');
    if (loading) {
      loading.classList.add('fade-out');
      setTimeout(() => {
        loading.style.display = 'none';
        state.isLoading = false;
      }, 500);
    }
  }

  // ==========================================
  // TASK OPERATIONS
  // ==========================================
  function addTask(text, priority, category, dueDate, subtasks) {
    if (!text || !text.trim()) {
      showToast('Please enter a task');
      return;
    }
    
    const task = {
      id: uuid(),
      text: text.trim(),
      priority: priority || 'medium',
      category: (category || 'General').trim(),
      dueDate: dueDate || null,
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      focusSessions: 0,
      focusMinutes: 0,
      subtasks: subtasks || [],
      recurring: null
    };
    state.tasks.unshift(task);
    saveData();
    render();
    showToast('✓ Task added');
    vibrate(50);
  }

  function updateTask(id, updates) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    Object.assign(task, updates);
    saveData();
    render();
  }

  function toggleTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    saveData();
    render();
    if (task.completed) {
      showToast('✓ Task completed!');
      checkAchievements();
      vibrate([50, 100, 50]);
    }
  }

  function deleteTask(id) {
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    const task = state.tasks[idx];
    state.deleted.unshift(task);
    state.tasks.splice(idx, 1);
    saveData();
    render();
    showToast('Task deleted');
    vibrate(30);
  }

  function restoreTask(id) {
    const idx = state.deleted.findIndex(t => t.id === id);
    if (idx === -1) return;
    const task = state.deleted[idx];
    state.tasks.unshift(task);
    state.deleted.splice(idx, 1);
    saveData();
    render();
    showToast('Task restored');
  }

  function permanentDelete(id) {
    state.deleted = state.deleted.filter(t => t.id !== id);
    saveData();
    renderTrash();
  }

  function toggleSubtask(taskId, subtaskIdx) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks[subtaskIdx]) return;
    task.subtasks[subtaskIdx].completed = !task.subtasks[subtaskIdx].completed;
    saveData();
    render();
  }

  // ==========================================
  // FILTERING
  // ==========================================
  function getFilteredTasks() {
    switch (state.filter) {
      case 'active': return state.tasks.filter(t => !t.completed);
      case 'completed': return state.tasks.filter(t => t.completed);
      case 'high': return state.tasks.filter(t => t.priority === 'high' && !t.completed);
      default: return state.tasks;
    }
  }

  // ==========================================
  // STATS
  // ==========================================
  function getStats() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const dates = [...new Set(state.tasks
      .filter(t => t.completed && t.completedAt)
      .map(t => new Date(t.completedAt).toDateString()))]
      .sort((a, b) => new Date(b) - new Date(a));

    let streak = 0;
    if (dates.length > 0) {
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (dates[0] === today || dates[0] === yesterday) {
        streak = 1;
        for (let i = 0; i < dates.length - 1; i++) {
          const curr = new Date(dates[i]);
          const next = new Date(dates[i + 1]);
          const diff = (curr - next) / 86400000;
          if (diff === 1) streak++;
          else break;
        }
      }
    }

    return { total, completed, pending, percent, streak };
  }

  function checkAchievements() {
    const stats = getStats();
    const totalFocus = state.tasks.reduce((s, t) => s + (t.focusMinutes || 0), 0);
    
    const achievements = [
      { id: 'first', condition: stats.completed >= 1, msg: '🌱 First task completed!' },
      { id: 'ten', condition: stats.completed >= 10, msg: '⭐ 10 tasks done!' },
      { id: 'streak3', condition: stats.streak >= 3, msg: '🔥 3-day streak!' },
      { id: 'streak7', condition: stats.streak >= 7, msg: '⚡ 7-day streak!' },
      { id: 'focus1h', condition: totalFocus >= 60, msg: '🎯 Focus hour reached!' },
      { id: 'fifty', condition: stats.completed >= 50, msg: '🏆 50 tasks completed!' }
    ];

    const unlocked = JSON.parse(localStorage.getItem('***') || '[]');
    
    achievements.forEach(ach => {
      if (ach.condition && !unlocked.includes(ach.id)) {
        unlocked.push(ach.id);
        showToast(ach.msg);
        vibrate([100, 50, 100]);
      }
    });
    
    localStorage.setItem('***', JSON.stringify(unlocked));
  }

  // ==========================================
  // RENDERING
  // ==========================================
  function render() {
    renderHeader();
    renderProgress();
    renderTasks();
    renderTrash();
  }

  function renderHeader() {
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    $('greeting').textContent = greeting;
    $('date-display').textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });
  }

  function renderProgress() {
    const stats = getStats();
    $('progress-text').textContent = stats.percent + '%';
    $('progress-bar').style.width = stats.percent + '%';
    $('stat-completed').textContent = stats.completed;
    $('stat-remaining').textContent = stats.pending;
    $('stat-streak').textContent = stats.streak;
  }

  function renderTasks() {
    const container = $('tasks-container');
    const empty = $('empty-state');
    const tasks = getFilteredTasks();

    if (tasks.length === 0) {
      container.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    container.innerHTML = tasks.map((task, i) => {
      const isEditing = state.editingTask === task.id;
      const hasSubtasks = task.subtasks && task.subtasks.length > 0;
      const subtasksCompleted = hasSubtasks ? task.subtasks.filter(s => s.completed).length : 0;
      const progressPercent = hasSubtasks ? Math.round((subtasksCompleted / task.subtasks.length) * 100) : 0;
      
      return `
      <div class="task-item priority-${task.priority} ${task.completed ? 'completed' : ''}" 
           data-id="${task.id}" 
           style="animation-delay: ${i * 0.05}s">
        
        <div class="task-content-wrapper">
          <div class="task-main">
            <div class="task-checkbox ${task.completed ? 'checked' : ''}" data-action="toggle"></div>
            <div class="task-content">
              ${isEditing ? `
                <input type="text" class="task-edit-input" value="${escapeHtml(task.text)}" data-field="text">
                <div class="task-edit-row">
                  <select class="task-edit-select" data-field="priority">
                    <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                    <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                  </select>
                  <input type="datetime-local" class="task-edit-date" value="${task.dueDate || ''}" data-field="dueDate">
                  <button class="btn-save-edit" data-action="save-edit">Save</button>
                  <button class="btn-cancel-edit" data-action="cancel-edit">Cancel</button>
                </div>
              ` : `
                <div class="task-title">${escapeHtml(task.text)}</div>
                <div class="task-meta">
                  ${task.category ? `<span class="task-category">${escapeHtml(task.category)}</span>` : ''}
                  ${task.dueDate ? `<span class="task-due ${isOverdue(task.dueDate) ? 'overdue' : ''}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    ${formatDate(task.dueDate)}
                  </span>` : ''}
                  ${hasSubtasks ? `<span class="task-subtask-count">${subtasksCompleted}/${task.subtasks.length}</span>` : ''}
                </div>
              `}
            </div>
            <div class="task-actions">
              <button class="task-action-btn" data-action="edit" title="Edit">✏️</button>
              <button class="task-action-btn" data-action="focus" title="Focus">🎯</button>
              <button class="task-action-btn" data-action="add-subtask" title="Add subtask">➕</button>
              <button class="task-action-btn delete" data-action="delete" title="Delete">🗑️</button>
            </div>
          </div>
          
          ${hasSubtasks && !isEditing ? `
            <div class="subtask-progress-bar">
              <div class="subtask-progress-fill" style="width: ${progressPercent}%"></div>
            </div>
            <div class="subtasks-list">
              ${task.subtasks.map((sub, idx) => `
                <div class="subtask-item ${sub.completed ? 'completed' : ''}" data-subtask="${idx}">
                  <div class="subtask-checkbox ${sub.completed ? 'checked' : ''}"></div>
                  <span class="subtask-text">${escapeHtml(sub.text)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `}).join('');
  }

  function renderTrash() {
    const content = $('trash-content');
    const count = $('trash-count');
    count.textContent = state.deleted.length;

    if (state.deleted.length === 0) {
      content.innerHTML = '<p style="text-align:center;color:var(--text-tertiary);padding:var(--space-lg)">No deleted tasks</p>';
      return;
    }

    content.innerHTML = state.deleted.map(task => `
      <div class="task-item" style="opacity:0.6">
        <div class="task-main">
          <div class="task-content">
            <div class="task-title" style="text-decoration:line-through">${escapeHtml(task.text)}</div>
          </div>
          <div class="task-actions" style="opacity:1">
            <button class="task-action-btn" data-action="restore" data-id="${task.id}">↩️ Restore</button>
            <button class="task-action-btn delete" data-action="permanent-delete" data-id="${task.id}">🗑️ Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // ==========================================
  // FOCUS MODE
  // ==========================================
  function openFocusModal() {
    const pending = state.tasks.filter(t => !t.completed);
    const list = $('focus-task-list');

    if (pending.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-tertiary);padding:var(--space-lg)">No pending tasks</p>';
    } else {
      list.innerHTML = pending.map(t => `
        <div class="focus-task-option" data-id="${t.id}">
          <span class="focus-task-priority priority-${t.priority}"></span>
          <span class="focus-task-text">${escapeHtml(t.text)}</span>
        </div>
      `).join('');
    }

    document.querySelectorAll('.dur-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.min) === CONFIG.FOCUS_DEFAULT);
    });

    $('focus-setup').style.display = 'block';
    $('focus-active').style.display = 'none';
    openModal('focus-modal');
  }

  function startFocus(taskId, minutes) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    state.focusTask = task;
    state.focusDuration = minutes;
    state.focusTimeLeft = minutes * 60;

    $('focus-task-name').textContent = task.text;
    $('focus-setup').style.display = 'none';
    $('focus-active').style.display = 'block';

    updateFocusDisplay();
    state.focusInterval = setInterval(() => {
      state.focusTimeLeft--;
      updateFocusDisplay();
      if (state.focusTimeLeft <= 0) {
        completeFocus();
      }
    }, 1000);
  }

  function updateFocusDisplay() {
    const mins = Math.floor(state.focusTimeLeft / 60);
    const secs = state.focusTimeLeft % 60;
    $('focus-timer').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const progress = 1 - (state.focusTimeLeft / (state.focusDuration * 60));
    $('focus-progress-bar').style.width = `${progress * 100}%`;
  }

  function pauseFocus() {
    if (state.focusInterval) {
      clearInterval(state.focusInterval);
      state.focusInterval = null;
      $('focus-pause').textContent = 'Resume';
    } else {
      state.focusInterval = setInterval(() => {
        state.focusTimeLeft--;
        updateFocusDisplay();
        if (state.focusTimeLeft <= 0) completeFocus();
      }, 1000);
      $('focus-pause').textContent = 'Pause';
    }
  }

  function stopFocus() {
    if (state.focusInterval) {
      clearInterval(state.focusInterval);
      state.focusInterval = null;
    }
    state.focusTask = null;
    closeModal('focus-modal');
  }

  function completeFocus() {
    if (state.focusInterval) {
      clearInterval(state.focusInterval);
      state.focusInterval = null;
    }
    if (state.focusTask) {
      state.focusTask.focusSessions = (state.focusTask.focusSessions || 0) + 1;
      state.focusTask.focusMinutes = (state.focusTask.focusMinutes || 0) + state.focusDuration;
      saveData();
    }
    showToast('🎉 Focus session complete!');
    vibrate([100, 50, 100, 50, 200]);
    stopFocus();
  }

  // ==========================================
  // VOICE INPUT - ROBUST IMPLEMENTATION
  // ==========================================
  function initVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.log('SpeechRecognition not supported');
      const btn = $('btn-voice');
      if (btn) {
        btn.style.display = 'none';
      }
      return;
    }

    console.log('SpeechRecognition API available');
  }

  function createRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('Voice started');
      voiceState.isListening = true;
      voiceState.transcript = '';
      voiceState.interimTranscript = '';
      updateVoiceUI(true);
      
      // Auto-stop after timeout
      voiceState.timeoutId = setTimeout(() => {
        if (voiceState.isListening) {
          showToast('Voice timeout - processing...');
          stopVoice();
        }
      }, CONFIG.VOICE_TIMEOUT);
    };

    recognition.onresult = (event) => {
      voiceState.interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          voiceState.transcript += transcript + ' ';
        } else {
          voiceState.interimTranscript += transcript;
        }
      }
      
      const displayText = (voiceState.transcript + voiceState.interimTranscript).trim();
      updateVoiceTranscript(displayText);
    };

    recognition.onerror = (event) => {
      console.error('Voice error:', event.error);
      
      if (event.error === 'no-speech') {
        // Don't stop, just keep listening
        updateVoiceStatus('No speech detected, still listening...');
        return;
      }
      
      if (event.error === 'aborted') {
        // User cancelled
        return;
      }
      
      let message = 'Voice error occurred';
      switch(event.error) {
        case 'audio-capture':
          message = 'No microphone found';
          break;
        case 'not-allowed':
          message = 'Microphone access denied';
          break;
        case 'network':
          message = 'Network error';
          break;
      }
      
      updateVoiceStatus(message);
      stopVoice();
    };

    recognition.onend = () => {
      console.log('Voice ended, transcript:', voiceState.transcript);
      
      // Clear timeout
      if (voiceState.timeoutId) {
        clearTimeout(voiceState.timeoutId);
        voiceState.timeoutId = null;
      }
      
      // Process transcript if we have one
      if (voiceState.transcript.trim()) {
        processVoiceResult(voiceState.transcript.trim());
      } else if (voiceState.isListening) {
        // Still listening, restart
        setTimeout(() => {
          if (voiceState.isListening) {
            try {
              voiceState.recognition.start();
            } catch (e) {
              stopVoice();
            }
          }
        }, 200);
      }
    };

    return recognition;
  }

  function toggleVoice() {
    if (voiceState.isListening) {
      stopVoice();
    } else {
      startVoice();
    }
  }

  function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Voice not supported in this browser');
      return;
    }

    // Check HTTPS
    if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
      showToast('Voice requires HTTPS or localhost');
      return;
    }

    // Request microphone permission
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        openVoiceModal();
      })
      .catch(() => {
        showToast('Please allow microphone access');
      });
  }

  function openVoiceModal() {
    voiceState.transcript = '';
    voiceState.interimTranscript = '';
    voiceState.isProcessing = false;
    
    updateVoiceTranscript('');
    updateVoiceStatus('Tap Start to begin');
    updateVoiceUI(false);
    openModal('voice-modal');
  }

  function beginListening() {
    try {
      voiceState.recognition = createRecognition();
      voiceState.recognition.start();
    } catch (e) {
      console.error('Failed to start:', e);
      showToast('Failed to start voice');
      stopVoice();
    }
  }

  function stopVoice() {
    voiceState.isListening = false;
    
    if (voiceState.timeoutId) {
      clearTimeout(voiceState.timeoutId);
      voiceState.timeoutId = null;
    }
    
    if (voiceState.recognition) {
      try { voiceState.recognition.stop(); } catch (e) {}
      try { voiceState.recognition.abort(); } catch (e) {}
      voiceState.recognition = null;
    }
    
    updateVoiceUI(false);
    closeModal('voice-modal');
  }

  function processVoiceResult(text) {
    console.log('Processing voice result:', text);
    
    voiceState.isProcessing = true;
    showVoiceProcessing(true);
    
    // Small delay to show processing state
    setTimeout(() => {
      const result = parseVoiceInput(text);
      
      if (result.text) {
        addTask(result.text, result.priority, result.category, result.dueDate);
        showToast('✓ Task added from voice');
      } else {
        showToast('Could not understand. Try again.');
      }
      
      voiceState.isProcessing = false;
      showVoiceProcessing(false);
      stopVoice();
    }, 800);
  }

  function parseVoiceInput(text) {
    console.log('Parsing:', text);
    
    let priority = 'medium';
    let category = 'General';
    let dueDate = null;
    
    // Priority detection - must be explicit
    const priorityMatch = text.match(/\b(high|urgent|important|critical)\s+(priority|prio)?\b/i);
    if (priorityMatch) {
      priority = 'high';
    } else if (text.match(/\blow\s+(priority|prio)?\b/i)) {
      priority = 'low';
    }
    
    // Category detection - explicit only
    const catMatch = text.match(/\[([^\]]+)\]|\bin\s+([\w\s]+?)\s+(category|cat)\b/i);
    if (catMatch) {
      category = (catMatch[1] || catMatch[2]).trim();
    }
    
    // Date detection - only explicit date words
    const now = new Date();
    const lowerText = text.toLowerCase();
    
    // Only set date if explicitly mentioned
    if (/\btomorrow\b/.test(lowerText)) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0); // Default to 9 AM
      dueDate = d.toISOString().slice(0, 16);
    } else if (/\btoday\b/.test(lowerText)) {
      const d = new Date(now);
      d.setHours(23, 59, 0, 0); // End of today
      dueDate = d.toISOString().slice(0, 16);
    } else if (/\bnext week\b/.test(lowerText)) {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      dueDate = d.toISOString().slice(0, 16);
    }
    
    // Clean text - remove command words
    let cleanText = text
      .replace(/\b(high|low|urgent|important|critical)\s+(priority|prio)?\b/gi, '')
      .replace(/\[[^\]]+\]/g, '')
      .replace(/\bin\s+[\w\s]+?\s+(category|cat)\b/gi, '')
      .replace(/\b(tomorrow|today|next week)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Remove leading/trailing punctuation
    cleanText = cleanText.replace(/^[\s,.]+|[\s,.]+$/g, '');
    
    console.log('Parsed result:', { text: cleanText, priority, category, dueDate });
    
    return { text: cleanText, priority, category, dueDate };
  }

  function updateVoiceUI(isListening) {
    const toggleBtn = $('voice-toggle');
    const waves = document.querySelectorAll('.voice-wave');
    
    if (toggleBtn) {
      toggleBtn.textContent = isListening ? '⏹️ Stop' : '🎤 Start Listening';
      toggleBtn.className = isListening ? 'btn-danger voice-mic-btn' : 'btn-primary voice-mic-btn';
    }
    
    waves.forEach(wave => {
      wave.style.animationPlayState = isListening ? 'running' : 'paused';
      wave.style.opacity = isListening ? '1' : '0.3';
    });
  }

  function updateVoiceTranscript(text) {
    const el = $('voice-transcript');
    if (el) {
      el.textContent = text;
      el.style.display = text ? 'block' : 'none';
    }
    
    const statusEl = $('voice-status-text');
    if (statusEl && text) {
      statusEl.textContent = 'Listening...';
    }
  }

  function updateVoiceStatus(message) {
    const el = $('voice-status-text');
    if (el) el.textContent = message;
  }

  function showVoiceProcessing(show) {
    const el = $('voice-processing');
    if (el) el.style.display = show ? 'flex' : 'none';
  }

  // ==========================================
  // TEMPLATES
  // ==========================================
  const TEMPLATES = [
    { id: 'morning', name: 'Morning Routine', icon: '🌅', desc: 'Start your day right', tasks: [
      { text: 'Drink a glass of water', priority: 'high' },
      { text: 'Stretch for 10 minutes', priority: 'medium' },
      { text: 'Plan your day', priority: 'high' },
      { text: 'Healthy breakfast', priority: 'medium' }
    ]},
    { id: 'work', name: 'Deep Work', icon: '🎯', desc: 'Focused work session', tasks: [
      { text: 'Review priorities', priority: 'high' },
      { text: 'Focus on main task', priority: 'high' },
      { text: 'Take a break', priority: 'low' },
      { text: 'Review progress', priority: 'medium' }
    ]},
    { id: 'study', name: 'Study Session', icon: '📚', desc: 'Learn something new', tasks: [
      { text: 'Review previous material', priority: 'high' },
      { text: 'Read new content', priority: 'high' },
      { text: 'Take notes', priority: 'medium' },
      { text: 'Practice problems', priority: 'medium' }
    ]},
    { id: 'workout', name: 'Workout', icon: '💪', desc: 'Get moving', tasks: [
      { text: 'Warm up', priority: 'high' },
      { text: 'Main workout', priority: 'high' },
      { text: 'Cool down', priority: 'medium' },
      { text: 'Hydrate', priority: 'low' }
    ]},
    { id: 'evening', name: 'Evening Wind Down', icon: '🌙', desc: 'Relax and reflect', tasks: [
      { text: 'Review completed tasks', priority: 'medium' },
      { text: 'Prepare for tomorrow', priority: 'medium' },
      { text: 'Read or meditate', priority: 'low' },
      { text: 'Sleep hygiene', priority: 'high' }
    ]},
    { id: 'project', name: 'Project Launch', icon: '🚀', desc: 'Start a new project', tasks: [
      { text: 'Define scope', priority: 'high' },
      { text: 'Set milestones', priority: 'high' },
      { text: 'Assign tasks', priority: 'medium' },
      { text: 'Set deadlines', priority: 'high' }
    ]}
  ];

  function openTemplatesModal() {
    const grid = $('templates-grid');
    grid.innerHTML = TEMPLATES.map(t => `
      <div class="template-card" data-template="${t.id}">
        <div class="template-icon">${t.icon}</div>
        <h4>${t.name}</h4>
        <p>${t.desc}</p>
        <span class="template-task-count">${t.tasks.length} tasks</span>
      </div>
    `).join('');
    openModal('templates-modal');
  }

  function applyTemplate(id) {
    const tpl = TEMPLATES.find(t => t.id === id);
    if (!tpl) return;
    tpl.tasks.forEach(t => addTask(t.text, t.priority, tpl.name));
    closeModal('templates-modal');
    showToast(`Applied ${tpl.name}`);
  }

  // ==========================================
  // STATS MODAL
  // ==========================================
  function openStatsModal() {
    const stats = getStats();
    const totalFocus = state.tasks.reduce((s, t) => s + (t.focusMinutes || 0), 0);
    const totalSessions = state.tasks.reduce((s, t) => s + (t.focusSessions || 0), 0);

    $('stats-content').innerHTML = `
      <div class="stats-score">
        <div class="score-circle">
          <span class="score-value">${stats.percent}</span>
        </div>
        <span class="score-label">Productivity Score</span>
      </div>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-val">${stats.completed}</div>
          <div class="stat-name">Completed</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${stats.pending}</div>
          <div class="stat-name">Pending</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${stats.streak}</div>
          <div class="stat-name">Day Streak</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${totalFocus}</div>
          <div class="stat-name">Focus Minutes</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${totalSessions}</div>
          <div class="stat-name">Focus Sessions</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${state.tasks.length}</div>
          <div class="stat-name">Total Tasks</div>
        </div>
      </div>
      <h3 style="margin-bottom:var(--space-md);font-size:1rem;font-weight:600">Achievements</h3>
      <div class="achievements-list">
        <div class="achievement-item ${stats.completed >= 1 ? 'unlocked' : ''}">
          <span class="ach-icon">🌱</span>
          <span class="ach-name">First Step</span>
        </div>
        <div class="achievement-item ${stats.completed >= 10 ? 'unlocked' : ''}">
          <span class="ach-icon">⭐</span>
          <span class="ach-name">10 Tasks</span>
        </div>
        <div class="achievement-item ${stats.streak >= 3 ? 'unlocked' : ''}">
          <span class="ach-icon">🔥</span>
          <span class="ach-name">3-Day Streak</span>
        </div>
        <div class="achievement-item ${stats.streak >= 7 ? 'unlocked' : ''}">
          <span class="ach-icon">⚡</span>
          <span class="ach-name">7-Day Streak</span>
        </div>
        <div class="achievement-item ${totalFocus >= 60 ? 'unlocked' : ''}">
          <span class="ach-icon">🎯</span>
          <span class="ach-name">Focus Hour</span>
        </div>
        <div class="achievement-item ${stats.completed >= 50 ? 'unlocked' : ''}">
          <span class="ach-icon">🏆</span>
          <span class="ach-name">50 Tasks</span>
        </div>
        <div class="achievement-item ${totalSessions >= 10 ? 'unlocked' : ''}">
          <span class="ach-icon">🧘</span>
          <span class="ach-name">10 Sessions</span>
        </div>
        <div class="achievement-item ${stats.completed >= 100 ? 'unlocked' : ''}">
          <span class="ach-icon">👑</span>
          <span class="ach-name">Century</span>
        </div>
      </div>
    `;
    openModal('stats-modal');
  }

  // ==========================================
  // MODALS
  // ==========================================
  function openModal(id) {
    const el = $(id);
    if (!el) return;
    el.style.display = 'flex';
    requestAnimationFrame(() => el.classList.add('active'));
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove('active');
    setTimeout(() => {
      if (!el.classList.contains('active')) {
        el.style.display = 'none';
        document.body.style.overflow = '';
      }
    }, 300);
  }

  // ==========================================
  // TOAST
  // ==========================================
  function showToast(message) {
    const container = $('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    
    requestAnimationFrame(() => toast.classList.add('show'));
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ==========================================
  // EVENT HANDLERS
  // ==========================================
  function initEventListeners() {
    // Add task
    $('btn-add').addEventListener('click', () => {
      const text = $('task-input').value.trim();
      if (!text) { showToast('Enter a task'); return; }
      addTask(text, $('task-priority').value, $('task-category').value, $('task-due').value);
      $('task-input').value = '';
      $('task-category').value = '';
      $('task-due').value = '';
    });

    $('task-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') $('btn-add').click();
    });

    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.filter = tab.dataset.filter;
        renderTasks();
      });
    });

    // Theme
    $('theme-toggle').addEventListener('click', toggleTheme);

    // Quick actions
    $('btn-focus').addEventListener('click', openFocusModal);
    $('btn-templates').addEventListener('click', openTemplatesModal);
    $('btn-voice').addEventListener('click', toggleVoice);
    $('stats-toggle').addEventListener('click', openStatsModal);

    // Trash toggle
    $('btn-trash').addEventListener('click', () => {
      $('trash-content').classList.toggle('open');
    });

    // Task list - event delegation
    $('tasks-container').addEventListener('click', (e) => {
      const item = e.target.closest('.task-item');
      if (!item) return;
      const id = item.dataset.id;

      if (e.target.closest('[data-action="toggle"]')) {
        toggleTask(id);
      } else if (e.target.closest('[data-action="delete"]')) {
        deleteTask(id);
      } else if (e.target.closest('[data-action="focus"]')) {
        const task = state.tasks.find(t => t.id === id);
        if (task) {
          state.focusTask = task;
          openFocusModal();
        }
      } else if (e.target.closest('[data-action="edit"]')) {
        state.editingTask = id;
        renderTasks();
      } else if (e.target.closest('[data-action="save-edit"]')) {
        const input = item.querySelector('[data-field="text"]');
        const priority = item.querySelector('[data-field="priority"]');
        const dueDate = item.querySelector('[data-field="dueDate"]');
        updateTask(id, {
          text: input.value,
          priority: priority.value,
          dueDate: dueDate.value
        });
        state.editingTask = null;
      } else if (e.target.closest('[data-action="cancel-edit"]')) {
        state.editingTask = null;
        renderTasks();
      } else if (e.target.closest('[data-action="add-subtask"]')) {
        const text = prompt('Subtask name:');
        if (text) {
          const task = state.tasks.find(t => t.id === id);
          if (task) {
            task.subtasks = task.subtasks || [];
            task.subtasks.push({ text, completed: false });
            saveData();
            render();
          }
        }
      }

      // Subtask toggle
      const subtaskEl = e.target.closest('.subtask-item');
      if (subtaskEl) {
        const idx = parseInt(subtaskEl.dataset.subtask);
        toggleSubtask(id, idx);
      }
    });

    // Trash - event delegation
    $('trash-content').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === 'restore') restoreTask(id);
      else if (btn.dataset.action === 'permanent-delete') permanentDelete(id);
    });

    // Focus modal
    $('focus-task-list').addEventListener('click', (e) => {
      const opt = e.target.closest('.focus-task-option');
      if (opt) {
        document.querySelectorAll('.focus-task-option').forEach(o => {
          o.style.borderColor = '';
          o.style.background = '';
        });
        opt.style.borderColor = 'var(--primary)';
        opt.style.background = 'var(--primary-glow)';
        state.focusTask = state.tasks.find(t => t.id === opt.dataset.id);
      }
    });

    document.querySelectorAll('.dur-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.focusDuration = parseInt(btn.dataset.min);
      });
    });

    // Focus controls
    $('focus-pause').addEventListener('click', pauseFocus);
    $('focus-stop').addEventListener('click', stopFocus);

    // Start focus from modal
    const startFocusBtn = document.createElement('button');
    startFocusBtn.className = 'btn-primary';
    startFocusBtn.textContent = 'Start Focus';
    startFocusBtn.style.marginTop = 'var(--space-lg)';
    startFocusBtn.style.width = '100%';
    startFocusBtn.addEventListener('click', () => {
      if (state.focusTask) {
        const customInput = $('custom-duration');
        let duration = state.focusDuration;
        if (customInput && customInput.value) {
          const custom = parseInt(customInput.value);
          if (custom >= 1 && custom <= 180) {
            duration = custom;
          }
        }
        closeModal('focus-modal');
        setTimeout(() => {
          openFocusModal();
          startFocus(state.focusTask.id, duration);
        }, 300);
      } else {
        showToast('Select a task first');
      }
    });
    $('focus-setup').appendChild(startFocusBtn);

    // Templates
    $('templates-grid').addEventListener('click', (e) => {
      const card = e.target.closest('.template-card');
      if (card) applyTemplate(card.dataset.template);
    });

    // Voice
    $('voice-stop').addEventListener('click', stopVoice);
    $('voice-toggle').addEventListener('click', () => {
      if (voiceState.isListening) {
        stopVoice();
      } else {
        beginListening();
      }
    });

    // Modal close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) closeModal(modal.id);
      });
    });

    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
      }
    });
  }

  // ==========================================
  // INIT
  // ==========================================
  function init() {
    loadData();
    initVoice();
    initEventListeners();
    render();
    
    // Hide loading screen after init
    setTimeout(hideLoadingScreen, 500);

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
