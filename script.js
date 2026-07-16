"use strict";

/* =====================================================
   ZENSPACE PRODUCTIVITY HUB
   SCRIPT.JS
   Vanilla ES6 — no frameworks, no libraries.
   Organized into small modules, each owning one feature.
===================================================== */

/* =====================================================
   0. STORAGE KEYS & SHARED HELPERS
===================================================== */

const STORAGE_KEYS = {
  theme: "zenspace_theme",
  tasks: "zenspace_tasks",
  habits: "zenspace_habits",
  mood: "zenspace_mood",
  pomodoro: "zenspace_pomodoro"
};

/** Returns today's date as YYYY-MM-DD, used as a stable key for daily records. */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Safe JSON read from localStorage with a fallback value. */
function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.warn(`Could not read "${key}" from storage, using fallback.`, err);
    return fallback;
  }
}

/** Safe JSON write to localStorage. */
function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Could not write "${key}" to storage.`, err);
  }
}

/** Generates a reasonably unique id without any external library. */
function generateId() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* =====================================================
   1. LOADING SCREEN
===================================================== */

const Loader = {
  el: document.getElementById("loader"),

  hide() {
    if (!this.el) return;
    this.el.style.opacity = "0";
    this.el.style.pointerEvents = "none";
    setTimeout(() => {
      this.el.style.display = "none";
    }, 500);
  }
};

window.addEventListener("load", () => {
  setTimeout(() => Loader.hide(), 900);
});

/* =====================================================
   2. GREETING & LIVE DATE
===================================================== */

const Clock = {
  greetingEl: document.getElementById("greeting"),
  dateEl: document.getElementById("todayDate"),

  updateGreeting() {
    const hour = new Date().getHours();
    let text = "Good Morning 👋";
    if (hour >= 12 && hour < 17) text = "Good Afternoon 👋";
    else if (hour >= 17) text = "Good Evening 👋";
    if (this.greetingEl) this.greetingEl.textContent = text;
  },

  updateDate() {
    const options = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
    if (this.dateEl) {
      this.dateEl.textContent = new Date().toLocaleDateString("en-IN", options);
    }
  },

  tick() {
    this.updateGreeting();
    this.updateDate();
  },

  init() {
    this.tick();
    // Re-check every minute so the greeting flips at hour boundaries automatically.
    setInterval(() => this.tick(), 60 * 1000);
  }
};

/* =====================================================
   3. TOAST NOTIFICATIONS
===================================================== */

const Toast = {
  el: document.getElementById("toast"),
  hideTimer: null,

  show(message, type = "info") {
    if (!this.el) return;
    clearTimeout(this.hideTimer);
    this.el.textContent = message;
    this.el.className = `toast show ${type}`;
    this.hideTimer = setTimeout(() => {
      this.el.classList.remove("show");
    }, 2600);
  }
};

/* =====================================================
   4. THEME SWITCHER (Dark / Light + localStorage)
===================================================== */

const Theme = {
  toggleBtn: document.getElementById("themeToggle"),

  apply(theme) {
    const isLight = theme === "light";
    document.body.classList.toggle("light", isLight);
    if (this.toggleBtn) this.toggleBtn.textContent = isLight ? "☀️" : "🌙";
  },

  init() {
    const saved = readStorage(STORAGE_KEYS.theme, "dark");
    this.apply(saved);

    if (this.toggleBtn) {
      this.toggleBtn.addEventListener("click", () => {
        const next = document.body.classList.contains("light") ? "dark" : "light";
        this.apply(next);
        writeStorage(STORAGE_KEYS.theme, next);
      });
    }
  }
};

/* =====================================================
   5. SIDEBAR NAVIGATION (mobile toggle + active link)
===================================================== */

const Sidebar = {
  sidebarEl: document.getElementById("sidebar"),
  toggleBtn: document.getElementById("sidebarToggle"),
  links: document.querySelectorAll(".nav-link"),

  init() {
    if (this.toggleBtn && this.sidebarEl) {
      this.toggleBtn.addEventListener("click", () => {
        const isOpen = this.sidebarEl.classList.toggle("open");
        this.toggleBtn.setAttribute("aria-expanded", String(isOpen));
      });
    }

    this.links.forEach((link) => {
      link.addEventListener("click", () => {
        this.links.forEach((l) => l.classList.remove("active"));
        link.classList.add("active");
        // Auto-close the drawer on mobile after choosing a section.
        if (this.sidebarEl) this.sidebarEl.classList.remove("open");
      });
    });
  }
};

/* =====================================================
   6. SCROLL REVEAL ANIMATIONS
===================================================== */

const ScrollReveal = {
  init() {
    const targets = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || targets.length === 0) {
      targets.forEach((t) => t.classList.add("visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    targets.forEach((t) => observer.observe(t));
  }
};

/* =====================================================
   7. DAILY QUOTE (deterministic per day, no external API)
===================================================== */

const Quotes = {
  list: [
    "Small progress every day adds up to big results.",
    "Discipline is choosing between what you want now and what you want most.",
    "Focus on being productive instead of busy.",
    "The secret of getting ahead is getting started.",
    "Done is better than perfect.",
    "A little progress each day adds up to big results.",
    "Your future is created by what you do today, not tomorrow.",
    "Productivity is never an accident. It is the result of a commitment to excellence."
  ],

  init() {
    const el = document.getElementById("dailyQuote");
    if (!el) return;
    const dayIndex = new Date().getDate() % this.list.length;
    el.textContent = `"${this.list[dayIndex]}"`;
  }
};

/* =====================================================
   8. STATE — single source of truth for tasks/habits/mood/pomodoro
===================================================== */

const State = {
  tasks: readStorage(STORAGE_KEYS.tasks, []),
  habits: readStorage(STORAGE_KEYS.habits, {}),
  mood: readStorage(STORAGE_KEYS.mood, {}),
  pomodoro: readStorage(STORAGE_KEYS.pomodoro, { focusMinutes: 0, streak: 0, lastFocusDate: null }),

  saveTasks() {
    writeStorage(STORAGE_KEYS.tasks, this.tasks);
  },
  saveHabits() {
    writeStorage(STORAGE_KEYS.habits, this.habits);
  },
  saveMood() {
    writeStorage(STORAGE_KEYS.mood, this.mood);
  },
  savePomodoro() {
    writeStorage(STORAGE_KEYS.pomodoro, this.pomodoro);
  },

  exportAll() {
    return {
      tasks: this.tasks,
      habits: this.habits,
      mood: this.mood,
      pomodoro: this.pomodoro,
      exportedAt: new Date().toISOString()
    };
  },

  importAll(data) {
    if (!data || typeof data !== "object") throw new Error("Invalid file format.");
    this.tasks = Array.isArray(data.tasks) ? data.tasks : [];
    this.habits = data.habits && typeof data.habits === "object" ? data.habits : {};
    this.mood = data.mood && typeof data.mood === "object" ? data.mood : {};
    this.pomodoro = data.pomodoro && typeof data.pomodoro === "object"
      ? data.pomodoro
      : { focusMinutes: 0, streak: 0, lastFocusDate: null };

    this.saveTasks();
    this.saveHabits();
    this.saveMood();
    this.savePomodoro();
  },

  clearAll() {
    this.tasks = [];
    this.habits = {};
    this.mood = {};
    this.pomodoro = { focusMinutes: 0, streak: 0, lastFocusDate: null };
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  }
};

/* =====================================================
   9. STATS — dashboard cards derived from State
===================================================== */

const Stats = {
  els: {
    total: document.getElementById("totalTasks"),
    completed: document.getElementById("completedTasks"),
    focus: document.getElementById("focusMinutes"),
    productivity: document.getElementById("productivityScore"),
    streakCount: document.getElementById("streakCount"),
    sidebarStreak: document.getElementById("sidebarStreak")
  },

  render() {
    const total = State.tasks.length;
    const completed = State.tasks.filter((t) => t.column === "completed").length;
    const productivity = total === 0 ? 0 : Math.round((completed / total) * 100);

    if (this.els.total) this.els.total.textContent = String(total);
    if (this.els.completed) this.els.completed.textContent = String(completed);
    if (this.els.focus) this.els.focus.textContent = `${State.pomodoro.focusMinutes} min`;
    if (this.els.productivity) this.els.productivity.textContent = `${productivity}%`;
    if (this.els.streakCount) this.els.streakCount.textContent = String(State.pomodoro.streak);
    if (this.els.sidebarStreak) {
      this.els.sidebarStreak.textContent = `${State.pomodoro.streak} day${State.pomodoro.streak === 1 ? "" : "s"}`;
    }
  }
};

/* =====================================================
   10. KANBAN BOARD (render, add, delete, move, drag & drop)
===================================================== */

const Kanban = {
  columns: ["todo", "progress", "completed"],
  lists: {
    todo: document.getElementById("todoList"),
    progress: document.getElementById("progressList"),
    completed: document.getElementById("completedList")
  },
  counts: {
    todo: document.getElementById("todoCount"),
    progress: document.getElementById("progressCount"),
    completed: document.getElementById("completedCount")
  },
  columnLabels: { todo: "To Do", progress: "In Progress", completed: "Completed" },

  init() {
    document.querySelectorAll(".kanban-column").forEach((columnEl) => {
      const column = columnEl.dataset.column;

      columnEl.addEventListener("dragover", (e) => {
        e.preventDefault();
        columnEl.classList.add("drag-over");
      });

      columnEl.addEventListener("dragleave", () => {
        columnEl.classList.remove("drag-over");
      });

      columnEl.addEventListener("drop", (e) => {
        e.preventDefault();
        columnEl.classList.remove("drag-over");
        const taskId = e.dataTransfer.getData("text/plain");
        this.moveTask(taskId, column);
      });
    });
  },

  addTask(task) {
    State.tasks.unshift(task);
    State.saveTasks();
    this.render();
    Stats.render();
  },

  deleteTask(id) {
    State.tasks = State.tasks.filter((t) => t.id !== id);
    State.saveTasks();
    this.render();
    Stats.render();
    Toast.show("Task deleted", "info");
  },

  moveTask(id, newColumn) {
    const task = State.tasks.find((t) => t.id === id);
    if (!task || task.column === newColumn) return;
    task.column = newColumn;
    State.saveTasks();
    this.render();
    Stats.render();
    Toast.show(`Moved to ${this.columnLabels[newColumn]}`, "success");
  },

  buildTaskCard(task) {
    const card = document.createElement("div");
    card.className = "task";
    card.draggable = true;
    card.dataset.id = task.id;

    const priorityClass = `priority-${task.priority.toLowerCase()}`;
    const dueLabel = task.dueDate
      ? new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      : "No due date";

    card.innerHTML = `
      <div class="task-top">
        <span class="task-title"></span>
        <button class="task-delete" aria-label="Delete task">🗑</button>
      </div>
      <p class="task-desc"></p>
      <div class="task-meta">
        <span class="priority-badge ${priorityClass}"></span>
        <span class="task-due"></span>
      </div>
    `;

    // Set text via textContent (never innerHTML) to keep user input safe from injection.
    card.querySelector(".task-title").textContent = task.title;
    card.querySelector(".task-desc").textContent = task.description || "No description.";
    card.querySelector(".priority-badge").textContent = task.priority;
    card.querySelector(".task-due").textContent = dueLabel;

    card.querySelector(".task-delete").addEventListener("click", () => this.deleteTask(task.id));

    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", task.id);
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));

    return card;
  },

  render(filterText = "") {
    const query = filterText.trim().toLowerCase();

    this.columns.forEach((column) => {
      const listEl = this.lists[column];
      if (!listEl) return;
      listEl.innerHTML = "";

      const columnTasks = State.tasks.filter((t) => {
        const matchesColumn = t.column === column;
        const matchesQuery = !query || t.title.toLowerCase().includes(query);
        return matchesColumn && matchesQuery;
      });

      if (this.counts[column]) {
        this.counts[column].textContent = String(State.tasks.filter((t) => t.column === column).length);
      }

      if (columnTasks.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-column";
        empty.textContent = query ? "No matching tasks." : "No tasks yet.";
        listEl.appendChild(empty);
        return;
      }

      columnTasks.forEach((task) => listEl.appendChild(this.buildTaskCard(task)));
    });
  }
};

/* =====================================================
   11. TASK MODAL (add task + custom validation)
===================================================== */

const TaskModal = {
  modal: document.getElementById("taskModal"),
  openBtn: document.getElementById("openTaskModal"),
  closeBtn: document.getElementById("closeModal"),
  form: document.getElementById("taskForm"),
  fields: {
    title: document.getElementById("taskTitle"),
    description: document.getElementById("taskDescription"),
    priority: document.getElementById("taskPriority"),
    dueDate: document.getElementById("taskDueDate")
  },
  errors: {
    title: document.getElementById("titleError"),
    description: document.getElementById("descriptionError"),
    dueDate: document.getElementById("dueDateError"),
    form: document.getElementById("formError")
  },

  open() {
    if (!this.modal) return;
    this.modal.classList.add("open");
    this.resetErrors();
    this.form.reset();
    this.fields.title.focus();
  },

  close() {
    if (!this.modal) return;
    this.modal.classList.remove("open");
  },

  resetErrors() {
    Object.values(this.errors).forEach((el) => {
      if (el) el.textContent = "";
    });
    Object.values(this.fields).forEach((el) => el && el.classList.remove("invalid"));
  },

  /**
   * Custom validation — deliberately does not rely on the browser's
   * built-in constraint validation UI, per competition rules.
   */
  validate() {
    this.resetErrors();
    let isValid = true;

    const title = this.fields.title.value.trim();
    if (!title) {
      this.errors.title.textContent = "Task title is required.";
      this.fields.title.classList.add("invalid");
      isValid = false;
    } else if (title.length < 3) {
      this.errors.title.textContent = "Title must be at least 3 characters.";
      this.fields.title.classList.add("invalid");
      isValid = false;
    }

    const description = this.fields.description.value.trim();
    if (description.length > 200) {
      this.errors.description.textContent = "Description is too long.";
      this.fields.description.classList.add("invalid");
      isValid = false;
    }

    const dueDate = this.fields.dueDate.value;
    if (dueDate) {
      const chosen = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (chosen < today) {
        this.errors.dueDate.textContent = "Due date cannot be in the past.";
        this.fields.dueDate.classList.add("invalid");
        isValid = false;
      }
    }

    if (!isValid) {
      this.errors.form.textContent = "Please fix the highlighted fields.";
    }

    return isValid;
  },

  init() {
    if (this.openBtn) this.openBtn.addEventListener("click", () => this.open());
    if (this.closeBtn) this.closeBtn.addEventListener("click", () => this.close());
    if (this.modal) {
      this.modal.addEventListener("click", (e) => {
        if (e.target === this.modal) this.close();
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.modal && this.modal.classList.contains("open")) this.close();
    });

    if (this.form) {
      this.form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!this.validate()) return;

        const task = {
          id: generateId(),
          title: this.fields.title.value.trim(),
          description: this.fields.description.value.trim(),
          priority: this.fields.priority.value,
          dueDate: this.fields.dueDate.value || null,
          column: "todo",
          createdAt: new Date().toISOString()
        };

        Kanban.addTask(task);
        Toast.show("Task created", "success");
        this.close();
      });
    }
  }
};

/* =====================================================
   12. SEARCH (filters Kanban tasks live)
===================================================== */

const Search = {
  input: document.getElementById("searchInput"),

  init() {
    if (!this.input) return;
    this.input.addEventListener("input", () => {
      Kanban.render(this.input.value);
    });
  }
};

/* =====================================================
   13. POMODORO TIMER
===================================================== */

const Pomodoro = {
  FOCUS_SECONDS: 25 * 60,
  BREAK_SECONDS: 5 * 60,

  secondsLeft: 25 * 60,
  isBreak: false,
  isRunning: false,
  intervalId: null,

  display: document.getElementById("timerDisplay"),
  status: document.getElementById("timerStatus"),
  startBtn: document.getElementById("startBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  resetBtn: document.getElementById("resetBtn"),

  format(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  },

  render() {
    if (this.display) {
      this.display.textContent = this.format(this.secondsLeft);
      this.display.classList.toggle("break-mode", this.isBreak);
    }
    if (this.status) {
      this.status.textContent = this.isBreak ? "Break Time" : "Focus Session";
    }
    document.title = `${this.format(this.secondsLeft)} · ${this.isBreak ? "Break" : "Focus"} — ZenSpace`;

    if (this.startBtn) this.startBtn.disabled = this.isRunning;
    if (this.pauseBtn) this.pauseBtn.disabled = !this.isRunning;
  },

  tick() {
    if (this.secondsLeft > 0) {
      this.secondsLeft -= 1;
      this.render();
      return;
    }
    this.completeSession();
  },

  completeSession() {
    this.pause();

    if (!this.isBreak) {
      // A focus session just finished: log 25 minutes and bump the streak once per day.
      State.pomodoro.focusMinutes += 25;
      const today = todayKey();
      if (State.pomodoro.lastFocusDate !== today) {
        State.pomodoro.streak += 1;
        State.pomodoro.lastFocusDate = today;
      }
      State.savePomodoro();
      Stats.render();
      Toast.show("Focus session complete — take a break!", "success");
    } else {
      Toast.show("Break's over — ready to focus?", "info");
    }

    this.isBreak = !this.isBreak;
    this.secondsLeft = this.isBreak ? this.BREAK_SECONDS : this.FOCUS_SECONDS;
    this.render();
  },

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalId = setInterval(() => this.tick(), 1000);
    this.render();
  },

  pause() {
    this.isRunning = false;
    clearInterval(this.intervalId);
    this.render();
  },

  reset() {
    this.pause();
    this.isBreak = false;
    this.secondsLeft = this.FOCUS_SECONDS;
    this.render();
  },

  init() {
    this.render();
    if (this.startBtn) this.startBtn.addEventListener("click", () => this.start());
    if (this.pauseBtn) this.pauseBtn.addEventListener("click", () => this.pause());
    if (this.resetBtn) this.resetBtn.addEventListener("click", () => this.reset());
  }
};

/* =====================================================
   14. HABIT TRACKER (per-day checklist)
===================================================== */

const Habits = {
  items: document.querySelectorAll(".habit-item input[type='checkbox']"),

  getTodayRecord() {
    const key = todayKey();
    if (!State.habits[key]) State.habits[key] = {};
    return State.habits[key];
  },

  init() {
    const record = this.getTodayRecord();

    this.items.forEach((checkbox) => {
      const habitKey = checkbox.dataset.habit;
      checkbox.checked = Boolean(record[habitKey]);
      checkbox.closest(".habit-item").classList.toggle("completed", checkbox.checked);

      checkbox.addEventListener("change", () => {
        const todayRecord = this.getTodayRecord();
        todayRecord[habitKey] = checkbox.checked;
        State.saveHabits();
        checkbox.closest(".habit-item").classList.toggle("completed", checkbox.checked);
        Toast.show(checkbox.checked ? "Habit checked off 🎉" : "Habit unchecked", "info");
      });
    });
  }
};

/* =====================================================
   15. MOOD TRACKER (one mood per day)
===================================================== */

const Mood = {
  buttons: document.querySelectorAll(".mood-btn"),
  label: document.getElementById("selectedMood"),
  moodText: {
    excellent: "Feeling excellent today! 🤩",
    happy: "Feeling happy today. 😊",
    normal: "Feeling okay today. 😐",
    sad: "Feeling a bit down today. 😔",
    tired: "Feeling tired today. 😴"
  },

  init() {
    const key = todayKey();
    const savedMood = State.mood[key];

    this.buttons.forEach((btn) => {
      if (btn.dataset.mood === savedMood) btn.classList.add("selected");

      btn.addEventListener("click", () => {
        this.buttons.forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        State.mood[todayKey()] = btn.dataset.mood;
        State.saveMood();
        if (this.label) this.label.textContent = this.moodText[btn.dataset.mood];
        Toast.show("Mood saved for today", "success");
      });
    });

    if (savedMood && this.label) {
      this.label.textContent = this.moodText[savedMood];
    }
  }
};

/* =====================================================
   16. SETTINGS: EXPORT / IMPORT / CLEAR
===================================================== */

const Settings = {
  exportBtn: document.getElementById("exportData"),
  importBtn: document.getElementById("importData"),
  importFile: document.getElementById("importFile"),
  clearBtn: document.getElementById("clearData"),

  exportJSON() {
    const data = State.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `zenspace-backup-${todayKey()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    Toast.show("Data exported", "success");
  },

  importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        State.importAll(parsed);
        Kanban.render();
        Stats.render();
        Habits.init();
        Mood.init();
        Toast.show("Data imported successfully", "success");
      } catch (err) {
        console.error(err);
        Toast.show("Import failed — invalid file.", "error");
      }
    };
    reader.readAsText(file);
  },

  clearData() {
    const confirmed = window.confirm("This will permanently delete all ZenSpace data. Continue?");
    if (!confirmed) return;
    State.clearAll();
    Kanban.render();
    Stats.render();
    Pomodoro.reset();
    document.querySelectorAll(".habit-item").forEach((item) => item.classList.remove("completed"));
    document.querySelectorAll(".habit-item input").forEach((cb) => (cb.checked = false));
    document.querySelectorAll(".mood-btn").forEach((b) => b.classList.remove("selected"));
    if (Mood.label) Mood.label.textContent = "No mood selected";
    Toast.show("All data cleared", "info");
  },

  init() {
    if (this.exportBtn) this.exportBtn.addEventListener("click", () => this.exportJSON());
    if (this.importBtn && this.importFile) {
      this.importBtn.addEventListener("click", () => this.importFile.click());
      this.importFile.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) this.importJSON(file);
        e.target.value = "";
      });
    }
    if (this.clearBtn) this.clearBtn.addEventListener("click", () => this.clearData());
  }
};

/* =====================================================
   17. APP BOOTSTRAP
===================================================== */

function initApp() {
  Clock.init();
  Theme.init();
  Sidebar.init();
  ScrollReveal.init();
  Quotes.init();

  Kanban.init();
  Kanban.render();

  TaskModal.init();
  Search.init();
  Pomodoro.init();
  Habits.init();
  Mood.init();
  Settings.init();

  Stats.render();
}

document.addEventListener("DOMContentLoaded", initApp);