let currentEditTaskId = null;
let isEditExpanded = false;
let isDarkMode = false;
let isFiltersVisible = false;
let isTrashVisible = false;
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
    const progressPercent = document.getElementById('progress-percent');
    const progressFill = document.getElementById('progress-fill');
    const completedTasksEl = document.getElementById('completed-tasks');
    const tasksLeftEl = document.getElementById('tasks-left');
    const filterCategory = document.getElementById('filter-category');
    const filterPriority = document.getElementById('filter-priority');
    const filterStatus = document.getElementById('filter-status');
    const clearFilters = document.getElementById('clear-filters');
    const toggleFilters = document.getElementById('toggle-filters');
    const filterContent = document.getElementById('filter-content');
    const taskInput = document.getElementById('task-input');
    const addTaskBtn = document.getElementById('add-task-btn');
    const toggleTrash = document.getElementById('toggle-trash');
    const trashSection = document.getElementById('trash-section');
    const trashList = document.getElementById('trash-list');
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let deletedTasks = JSON.parse(localStorage.getItem('deletedTasks')) || [];

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
    renderTrash();
    updateProgress();
    updateTaskStats();

    // Ensure task input is focusable on Android
    taskInput.addEventListener('touchstart', () => {
        taskInput.focus();
    });

    // Add task - Form submission
    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('Form submitted');
        addTask();
    });

    // Fallback for Android - Click event on Add Task button
    addTaskBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Add Task button clicked');
        addTask();
    });

    // Function to handle adding a task
    function addTask() {
        const taskTitle = taskInput.value.trim();
        
        console.log('Task Title on Submit:', taskTitle);

        if (!taskTitle) {
            alert('Please enter a task title.');
            return;
        }

        const task = {
            id: Date.now(),
            text: taskTitle,
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
        updateTaskStats();
        taskForm.reset();
        scheduleNotification(task);
    }

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

    clearFilters.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Clear Filters clicked');
        filters = { category: '', priority: '', status: '' };
        filterCategory.value = '';
        filterPriority.value = '';
        filterStatus.value = '';
        saveFilters();
        renderTasks();
    });

    // Toggle filters section on mobile
    toggleFilters.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Toggle Filters clicked');
        isFiltersVisible = !isFiltersVisible;
        filterContent.classList.toggle('active', isFiltersVisible);
        toggleFilters.textContent = isFiltersVisible ? 'Hide Filters' : 'Show Filters';
    });

    // Toggle trash section
    toggleTrash.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Toggle Trash clicked');
        isTrashVisible = !isTrashVisible;
        trashSection.classList.toggle('active', isTrashVisible);
        toggleTrash.textContent = isTrashVisible ? 'Hide Trash' : 'Show Trash';
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
            const displayText = task.text || 'Untitled Task';
            taskEl.innerHTML = `
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleComplete(${task.id}, this.checked)">
                <span>${displayText} [${task.category}] - Due: ${task.dueDate ? new Date(task.dueDate).toLocaleString() : 'No due date'} ${overdueText}</span>
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
    }

    // Add event delegation for edit and toggle description buttons
    taskList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const toggleDescBtn = e.target.closest('.toggle-description-btn');
        
        if (editBtn) {
            const id = parseInt(editBtn.dataset.id);
            console.log('Edit button clicked for task ID:', id);
            toggleEditOptions(id);
            e.stopPropagation();
        }
        
        if (toggleDescBtn) {
            const id = parseInt(toggleDescBtn.dataset.id);
            console.log('Toggle Description button clicked for task ID:', id);
            toggleDescription(id);
            e.stopPropagation();
        }
    });

    // Render deleted tasks in the trash
    function renderTrash() {
        trashList.innerHTML = '';
        deletedTasks.forEach(task => {
            const trashTaskEl = document.createElement('div');
            trashTaskEl.classList.add('trash-task');
            trashTaskEl.innerHTML = `
                <span>${task.text} [${task.category}]</span>
                <div>
                    <button onclick="restoreTask(${task.id})">Restore</button>
                    <button onclick="permanentlyDeleteTask(${task.id})">Delete Permanently</button>
                </div>
            `;
            trashList.appendChild(trashTaskEl);
        });
    }

    // Toggle task completion
    window.toggleComplete = (id, checked) => {
        const task = tasks.find(t => t.id === id);
        task.completed = checked;
        task.completedAt = checked ? new Date().toISOString() : null;
        saveTasks();
        renderTasks();
        updateProgress();
        updateTaskStats();
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
        updateTaskStats();
        modal.style.display = 'none';
    });

    // Save tasks to localStorage
    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }

    // Save deleted tasks to localStorage
    function saveDeletedTasks() {
        localStorage.setItem('deletedTasks', JSON.stringify(deletedTasks));
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

    // Update task stats (completed and remaining tasks)
    function updateTaskStats() {
        const completedTasks = tasks.filter(t => t.completed).length;
        const tasksLeft = tasks.length - completedTasks;
        completedTasksEl.textContent = completedTasks;
        tasksLeftEl.textContent = tasksLeft;
    }

    // Toggle dark mode
    toggleDarkMode.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Toggle Dark Mode clicked');
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('dark-mode', isDarkMode);
        localStorage.setItem('darkMode', isDarkMode);
        renderTasks();
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

    // Delete task (move to trash)
    window.deleteTask = (id) => {
        const taskEl = document.querySelector(`.task:nth-child(${tasks.findIndex(t => t.id === id) + 1})`);
        taskEl.classList.add('removing-task');
        setTimeout(() => {
            const task = tasks.find(t => t.id === id);
            deletedTasks.push(task);
            tasks = tasks.filter(t => t.id !== id);
            saveTasks();
            saveDeletedTasks();
            populateCategoryFilter();
            renderTasks();
            renderTrash();
            updateProgress();
            updateTaskStats();
        }, 500);
    };

    // Restore task from trash
    window.restoreTask = (id) => {
        const task = deletedTasks.find(t => t.id === id);
        tasks.push(task);
        deletedTasks = deletedTasks.filter(t => t.id !== id);
        saveTasks();
        saveDeletedTasks();
        populateCategoryFilter();
        renderTasks();
        renderTrash();
        updateProgress();
        updateTaskStats();
    };

    // Permanently delete task from trash
    window.permanentlyDeleteTask = (id) => {
        deletedTasks = deletedTasks.filter(t => t.id === id);
        saveDeletedTasks();
        renderTrash();
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
