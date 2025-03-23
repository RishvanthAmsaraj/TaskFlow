let currentEditTaskId = null;
let isEditExpanded = false;
let isDarkMode = false;
let isStatsVisible = false;
let isFiltersVisible = false;
let filters = {
    category: '',
    priority: '',
    status: ''
};

document.addEventListener('DOMContentLoaded', () => {
    const taskForm = document.getElementById('task-form');
    const taskList = document.getElementById('task-list');
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalInput = document.getElementById('modal-input');
    const modalDueDate = document.getElementById('modal-due-date');
    const modalSave = document.getElementById('modal-save');
    const closeModal = document.querySelector('.close');
    const toggleDarkMode = document.getElementById('toggle-dark-mode');
    const toggleStats = document.getElementById('toggle-stats');
    const statsSection = document.getElementById('stats-section');
    const progressPercent = document.getElementById('progress-percent');
    const progressFill = document.getElementById('progress-fill');
    const completedThisWeekEl = document.getElementById('completed-this-week');
    const uncompletedTasksEl = document.getElementById('uncompleted-tasks');
    const filterCategory = document.getElementById('filter-category');
    const filterPriority = document.getElementById('filter-priority');
    const filterStatus = document.getElementById('filter-status');
    const clearFilters = document.getElementById('clear-filters');
    const toggleFilters = document.getElementById('toggle-filters');
    const filterContent = document.getElementById('filter-content');
    const chartContainer = document.querySelector('.chart-container');
    const productivityChart = document.getElementById('productivity-chart').getContext('2d');
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];

    // Load dark mode preference from localStorage
    isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.body.classList.toggle('dark-mode', isDarkMode);

    // Load filter state from localStorage
    const savedFilters = JSON.parse(localStorage.getItem('filters')) || {};
    filters = { ...filters, ...savedFilters };

    // Apply saved filters to dropdowns
    filterCategory.value = filters.category;
    filterPriority.value = filters.priority;
    filterStatus.value = filters.status;

    // Load existing tasks and update UI
    populateCategoryFilter();
    renderTasks();
    updateProgress();
    updateStats();
    drawProductivityChart();

    // Toggle stats section
    toggleStats.addEventListener('click', () => {
        isStatsVisible = !isStatsVisible;
        statsSection.classList.toggle('active', isStatsVisible);
        toggleStats.textContent = isStatsVisible ? 'Hide Stats' : 'Show Stats';
        if (isStatsVisible) {
            setTimeout(() => {
                drawProductivityChart();
                chartContainer.classList.add('visible');
            }, 500);
        } else {
            chartContainer.classList.remove('visible');
        }
    });

    // Toggle filters section on mobile
    toggleFilters.addEventListener('click', () => {
        isFiltersVisible = !isFiltersVisible;
        filterContent.classList.toggle('active', isFiltersVisible);
        toggleFilters.textContent = isFiltersVisible ? 'Hide Filters' : 'Show Filters';
    });

    // Add task
    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const task = {
            id: Date.now(),
            text: document.getElementById('task-input').value,
            description: document.getElementById('task-description').value || '',
            category: document.getElementById('category-input').value,
            dueDate: document.getElementById('due-date-input').value,
            priority: document.getElementById('priority-input').value,
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null
        };
        tasks.push(task);
        saveTasks();
        populateCategoryFilter();
        renderTasks();
        updateProgress();
        updateStats();
        drawProductivityChart();
        taskForm.reset();
        scheduleNotification(task);
    });

    // Filter tasks
    filterCategory.addEventListener('change', (e) => {
        filters.category = e.target.value;
        saveFilters();
        renderTasks();
    });

    filterPriority.addEventListener('change', (e) => {
        filters.priority = e.target.value;
        saveFilters();
        renderTasks();
    });

    filterStatus.addEventListener('change', (e) => {
        filters.status = e.target.value;
        saveFilters();
        renderTasks();
    });

    clearFilters.addEventListener('click', () => {
        filters = { category: '', priority: '', status: '' };
        filterCategory.value = '';
        filterPriority.value = '';
        filterStatus.value = '';
        saveFilters();
        renderTasks();
    });

    // Populate category filter dropdown
    function populateCategoryFilter() {
        const categories = [...new Set(tasks.map(task => task.category))];
        filterCategory.innerHTML = '<option value="">All Categories</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            filterCategory.appendChild(option);
        });
        filterCategory.value = filters.category;
    }

    // Render tasks with filters
    function renderTasks() {
        taskList.innerHTML = '';
        let filteredTasks = tasks;

        if (filters.category) {
            filteredTasks = filteredTasks.filter(task => task.category === filters.category);
        }
        if (filters.priority) {
            filteredTasks = filteredTasks.filter(task => task.priority === filters.priority);
        }
        if (filters.status) {
            filteredTasks = filteredTasks.filter(task => 
                filters.status === 'completed' ? task.completed : !task.completed
            );
        }

        filteredTasks.forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.classList.add('task');
            if (task === tasks[tasks.length - 1]) taskEl.classList.add('new-task');
            taskEl.classList.add(task.priority);
            if (task.completed) taskEl.classList.add('completed');
            const overdueText = task.dueDate && new Date(task.dueDate) < new Date() ? '<span class="overdue-text">OVERDUE</span>' : '';
            taskEl.innerHTML = `
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleComplete(${task.id}, this.checked)">
                <span>${task.text} [${task.category}] - Due: ${task.dueDate ? new Date(task.dueDate).toLocaleString() : 'No due date'} ${overdueText}</span>
                <div class="task-description">${task.description}</div>
                <div class="task-buttons">
                    <button class="toggle-description-btn" data-id="${task.id}">Toggle Description</button>
                    <button class="edit-btn" data-id="${task.id}">Edit</button>
                    <div class="edit-options">
                        <button onclick="editText(${task.id})">Edit Text</button>
                        <button onclick="editDescription(${task.id})">Edit Description</button>
                        <button onclick="editCategory(${task.id})">Edit Category</button>
                        <button onclick="editDueDate(${task.id})">Edit Due Date</button>
                    </div>
                    <button onclick="deleteTask(${task.id})">Delete</button>
                </div>
            `;
            taskList.appendChild(taskEl);

            taskEl.addEventListener('click', (e) => {
                if (!e.target.closest('.task-buttons') && e.target.type !== 'checkbox') {
                    toggleComplete(task.id, !task.completed);
                }
            });

            setTimeout(() => taskEl.classList.remove('new-task'), 500);
        });

        // Add event delegation for edit buttons and toggle description buttons
        taskList.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            const toggleDescBtn = e.target.closest('.toggle-description-btn');
            
            if (editBtn) {
                const id = parseInt(editBtn.dataset.id);
                toggleEditOptions(id);
                e.stopPropagation();
            }
            
            if (toggleDescBtn) {
                const id = parseInt(toggleDescBtn.dataset.id);
                toggleDescription(id);
                e.stopPropagation();
            }
        }, { once: true }); // Use { once: true } to avoid multiple listeners
    }

    // Toggle task completion
    window.toggleComplete = (id, checked) => {
        const task = tasks.find(t => t.id === id);
        task.completed = checked;
        task.completedAt = checked ? new Date().toISOString() : null;
        saveTasks();
        renderTasks();
        updateProgress();
        updateStats();
        drawProductivityChart();
    };

    // Toggle description dropdown
    window.toggleDescription = (id) => {
        const taskEl = document.querySelector(`.task:nth-child(${tasks.findIndex(t => t.id === id) + 1})`);
        taskEl.classList.toggle('active');
    };

    // Toggle edit options
    window.toggleEditOptions = (id) => {
        currentEditTaskId = id;
        const taskButtons = document.querySelector(`.task:nth-child(${tasks.findIndex(t => t.id === id) + 1}) .task-buttons`);
        isEditExpanded = !isEditExpanded;
        renderTasks();
    };

    // Edit text
    window.editText = (id) => {
        currentEditTaskId = id;
        const task = tasks.find(t => t.id === id);
        modalTitle.textContent = 'Edit Text';
        modalInput.value = task.text;
        modalInput.style.display = 'block';
        modalDueDate.style.display = 'none';
        modal.style.display = 'flex';
    };

    // Edit description
    window.editDescription = (id) => {
        currentEditTaskId = id;
        const task = tasks.find(t => t.id === id);
        modalTitle.textContent = 'Edit Description';
        modalInput.value = task.description;
        modalInput.style.display = 'block';
        modalDueDate.style.display = 'none';
        modal.style.display = 'flex';
    };

    // Edit category
    window.editCategory = (id) => {
        currentEditTaskId = id;
        const task = tasks.find(t => t.id === id);
        modalTitle.textContent = 'Edit Category';
        modalInput.value = task.category;
        modalInput.style.display = 'block';
        modalDueDate.style.display = 'none';
        modal.style.display = 'flex';
    };

    // Edit due date
    window.editDueDate = (id) => {
        currentEditTaskId = id;
        const task = tasks.find(t => t.id === id);
        modalTitle.textContent = 'Edit Due Date';
        modalInput.style.display = 'none';
        modalDueDate.value = task.dueDate || '';
        modalDueDate.style.display = 'block';
        modal.style.display = 'flex';
    };

    // Save modal changes
    modalSave.addEventListener('click', () => {
        const task = tasks.find(t => t.id === currentEditTaskId);
        if (modalTitle.textContent === 'Edit Text') {
            task.text = modalInput.value;
        } else if (modalTitle.textContent === 'Edit Description') {
            task.description = modalInput.value;
        } else if (modalTitle.textContent === 'Edit Category') {
            task.category = modalInput.value;
            populateCategoryFilter();
        } else if (modalTitle.textContent === 'Edit Due Date') {
            task.dueDate = modalDueDate.value;
        }
        saveTasks();
        renderTasks();
        updateProgress();
        updateStats();
        drawProductivityChart();
        modal.style.display = 'none';
    });

    // Save tasks to localStorage
    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }

    // Save filters to localStorage
    function saveFilters() {
        localStorage.setItem('filters', JSON.stringify(filters));
    }

    // Update progress
    function updateProgress() {
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.completed).length;
        const percent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        progressPercent.textContent = `${Math.round(percent)}%`;
        progressFill.style.width = `${percent}%`;
    }

    // Update stats
    function updateStats() {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const completedThisWeek = tasks.filter(t => t.completed && new Date(t.completedAt) >= oneWeekAgo).length;
        const uncompletedTasks = tasks.filter(t => !t.completed).length;
        completedThisWeekEl.textContent = completedThisWeek;
        uncompletedTasksEl.textContent = uncompletedTasks;
    }

    // Draw productivity chart
    function drawProductivityChart() {
        const now = new Date();
        const days = Array(7).fill(0).map((_, i) => {
            const date = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        });
        const completedPerDay = Array(7).fill(0);
        tasks.forEach(task => {
            if (task.completed && task.completedAt) {
                const completedDate = new Date(task.completedAt);
                const daysAgo = Math.floor((now - completedDate) / (24 * 60 * 60 * 1000));
                if (daysAgo >= 0 && daysAgo < 7) {
                    completedPerDay[6 - daysAgo]++;
                }
            }
        });

        const maxTasks = Math.max(...completedPerDay, 5);
        const ctx = productivityChart;
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        ctx.imageSmoothingEnabled = true;

        const padding = 50;
        const chartHeight = canvasHeight - padding * 2;
        const chartWidth = canvasWidth - padding * 2;
        const yAxisSteps = 5;
        const xAxisPoints = 7;

        ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvasHeight - padding);
        ctx.lineTo(canvasWidth - padding, canvasHeight - padding);
        ctx.stroke();

        ctx.font = '12px Inter';
        ctx.fillStyle = isDarkMode ? 'rgba(245, 245, 247, 0.6)' : 'rgba(29, 29, 31, 0.6)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= yAxisSteps; i++) {
            const value = Math.round((maxTasks * (yAxisSteps - i)) / yAxisSteps);
            const y = padding + (i * chartHeight) / yAxisSteps;
            ctx.fillText(value, padding - 15, y);
        }

        ctx.textAlign = 'center';
        days.forEach((day, i) => {
            const x = padding + (i * chartWidth) / (xAxisPoints - 1);
            ctx.fillText(day, x, canvasHeight - padding + 25);
        });

        const points = completedPerDay.map((count, i) => {
            const x = padding + (i * chartWidth) / (xAxisPoints - 1);
            const y = canvasHeight - padding - (count / maxTasks) * chartHeight;
            return { x, y };
        });

        ctx.beginPath();
        ctx.strokeStyle = '#ff8c66';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();

        points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ff8c66';
            ctx.fill();
        });
    }

    // Toggle dark mode
    toggleDarkMode.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('dark-mode', isDarkMode);
        localStorage.setItem('darkMode', isDarkMode);
        renderTasks();
        drawProductivityChart();
    });

    // Close modal
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Delete task with animation
    window.deleteTask = (id) => {
        const taskEl = document.querySelector(`.task:nth-child(${tasks.findIndex(t => t.id === id) + 1})`);
        taskEl.classList.add('removing-task');
        setTimeout(() => {
            tasks = tasks.filter(t => t.id !== id);
            saveTasks();
            populateCategoryFilter();
            renderTasks();
            updateProgress();
            updateStats();
            drawProductivityChart();
        }, 500);
    };

    // Schedule browser notification
    function scheduleNotification(task) {
        if (task.dueDate && Notification.permission === 'granted') {
            const dueTime = new Date(task.dueDate).getTime();
            const now = Date.now();
            if (dueTime > now) {
                setTimeout(() => {
                    new Notification(`Task Due: ${task.text}`, {
                        body: `Description: ${task.description || 'No description'}, Category: ${task.category}`,
                    });
                }, dueTime - now);
            }
        } else if (task.dueDate) {
            Notification.requestPermission();
        }
    }
});
