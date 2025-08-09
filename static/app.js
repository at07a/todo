const API_TASKS = "/api/tasks";
const API_LISTS = "/api/lists";

function createModal({ title, message, input = false, confirmText = "Ok", cancelText = "Cancel" }) {
    return new Promise((resolve) => {
        const modal = document.createElement("div");
        modal.className = "custom-modal-overlay";
        modal.innerHTML = `
            <div class="custom-modal">
                <h3>${title}</h3>
                <p>${message || ""}</p>
                ${input ? `<input type="text" class="custom-modal-input" autofocus>` : ""}
                <div class="modal-buttons">
                    <button class="modal-confirm">${confirmText}</button>
                    ${cancelText ? `<button class="modal-cancel">${cancelText}</button>` : ""}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const confirmBtn = modal.querySelector(".modal-confirm");
        const cancelBtn = modal.querySelector(".modal-cancel");
        const inputEl = modal.querySelector(".custom-modal-input");

        confirmBtn.addEventListener("click", () => {
            const val = input ? inputEl.value.trim() : true;
            modal.remove();
            resolve(val || null);
        });

        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
                modal.remove();
                resolve(null);
            });
        }
    });
}

async function modalAlert(msg) {
    await createModal({ title: "Notice", message: msg, input: false, confirmText: "Ok", cancelText: "" });
}

async function modalConfirm(msg) {
    return (await createModal({ title: "Confirm", message: msg, input: false, confirmText: "Yes", cancelText: "No" })) !== null;
}

async function modalPrompt(msg) {
    return await createModal({ title: "Enter Value", message: msg, input: true, confirmText: "OK", cancelText: "Cancel" });
}

async function fetchJSON(url, opts) {
    const res = await fetch(url, opts);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "what" }));
        throw err;
    }
    return res.json();
}



async function fetchLists() {
    return fetchJSON(API_LISTS);
}

async function fetchTasks() {
    return fetchJSON(API_TASKS);
}

function createCardElement(task) {
    const el = document.createElement("div");
    el.className = "card";
    el.draggable = true;
    el.dataset.id = task.id;

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = task.title;

    const btns = document.createElement("div");
    const del = document.createElement("button");
    del.textContent = "✖";
    del.title = "Delete";
    del.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!(await modalConfirm("Delete this task?"))) return;
        try {
            await fetchJSON(`${API_TASKS}/${task.id}`, { method: "DELETE" });
            el.remove();
        } catch (err) {
            alert(err.error || "uh oh an error, and i didnt write code to catch the error so this is all u get");
        }
    });

    btns.appendChild(del);
    el.appendChild(title);
    el.appendChild(btns);

    el.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", task.id);
        el.classList.add("dragging");
    });
    el.addEventListener("dragend", () => {
        el.classList.remove("dragging");
    });

    return el;
}

async function createListElement(list) {
    const section = document.createElement("section");
    section.className = "column";
    section.dataset.listId = list.id;
    section.dataset.position = list.position;

    const header = document.createElement("div");
    header.className = "list-header";

    const h2 = document.createElement("h2");
    h2.textContent = list.title;

    const bin = document.createElement("button");
    bin.className = "delete-list-btn";
    bin.innerHTML = `<img src="/static/bin.png" alt="Delete" class="delete-icon">`;
    bin.title = "Delete list";
    bin.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!(await modalConfirm(`Delete list "${list.title}"?`))) return;
        try {
            await fetchJSON(`${API_LISTS}/${list.id}`, { method: "DELETE" });
            await loadAndRender();
            section.remove();
        } catch (err) {
            alert(err.error || "uh oh an error, and i didnt write code to catch the error so this is all u get");
        }
    });

    header.appendChild(h2);
    header.appendChild(bin);
    section.appendChild(header);

    const listDiv = document.createElement("div");
    listDiv.className = "list";
    listDiv.id = `list-${list.id}`;
    listDiv.addEventListener("dragover", (e) => e.preventDefault());

    listDiv.addEventListener("drop", async (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        const card = document.querySelector(`.card[data-id='${id}']`);
        if (!card) return;
        listDiv.prepend(card);
        try {
            await fetchJSON(`${API_TASKS}/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ list_id: list.id })
            });
        } catch (err) {
            alert(err.error || "uh oh an error, and i didnt write code to catch the error so this is all u get");
            await loadAndRender();
        }
    });

    section.appendChild(listDiv);
    return section;
}

const customSelectWrapper = document.querySelector(".custom-select-wrapper");
const selectedSpan = customSelectWrapper.querySelector(".custom-select-selected");
const optionsList = customSelectWrapper.querySelector(".custom-select-options");

let listsCache = [];
let expanded = false;
let currentIndex = -1;
let currentValue = null;

function openDropdown() {
    expanded = true;
    customSelectWrapper.setAttribute("aria-expanded", "true");
    optionsList.hidden = false;
    if (currentValue !== null) {
        currentIndex = listsCache.findIndex(l => l.id === currentValue);
    } else {
        currentIndex = -1;
    }
    highlightOption(currentIndex);
}

function closeDropdown() {
    expanded = false;
    customSelectWrapper.setAttribute("aria-expanded", "false");
    optionsList.hidden = true;
    removeHighlight();
}

function highlightOption(index) {
    const options = optionsList.querySelectorAll("li");
    options.forEach((opt, i) => {
        if (i === index) {
            opt.setAttribute("aria-selected", "true");
            opt.scrollIntoView({ block: "nearest" });
        } else {
            opt.removeAttribute("aria-selected");
        }
    });
}

function removeHighlight() {
    optionsList.querySelectorAll("li").forEach(opt => opt.removeAttribute("aria-selected"));
}

function selectOption(index) {
    if (index < 0 || index >= listsCache.length) return;
    currentValue = listsCache[index].id;
    selectedSpan.textContent = listsCache[index].title;
    closeDropdown();
    currentIndex = index;
}

customSelectWrapper.addEventListener("click", () => {
    expanded ? closeDropdown() : openDropdown();
});

customSelectWrapper.addEventListener("keydown", (e) => {
    const options = optionsList.querySelectorAll("li");
    if (!expanded && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ")) {
        e.preventDefault();
        openDropdown();
        return;
    }
    if (expanded) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            currentIndex = (currentIndex + 1) % options.length;
            highlightOption(currentIndex);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            currentIndex = (currentIndex - 1 + options.length) % options.length;
            highlightOption(currentIndex);
        } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            selectOption(currentIndex);
        } else if (e.key === "Escape") {
            e.preventDefault();
            closeDropdown();
        }
    }
});

optionsList.addEventListener("click", (e) => {
    if (e.target.tagName === "LI") {
        const index = [...optionsList.children].indexOf(e.target);
        selectOption(index);
    }
});

document.addEventListener("click", (e) => {
    if (!customSelectWrapper.contains(e.target)) closeDropdown();
});

async function loadAndRender() {
    const board = document.getElementById("board");

    board.innerHTML = "";
    optionsList.innerHTML = "";
    selectedSpan.textContent = "Select status";
    currentValue = null;

    const lists = await fetchLists();
    listsCache = lists;

    lists.forEach(list => {
        const li = document.createElement("li");
        li.textContent = list.title;
        li.dataset.value = list.id;
        li.setAttribute("role", "option");
        optionsList.appendChild(li);
    });

    const tasks = await fetchTasks();

    for (const l of lists) {
        const sec = await createListElement(l);
        board.appendChild(sec);
    }

    tasks.forEach(t => {
        const el = createCardElement(t);
        const parent = document.getElementById(`list-${t.list_id}`);
        if (parent) parent.appendChild(el);
    });

    const addListCard = document.createElement("section");
    addListCard.className = "column add-list";
    addListCard.innerHTML = `<button class="add-list-btn">+ Add another list</button>`;

    addListCard.querySelector(".add-list-btn").addEventListener("click", async () => {
        const title = await modalPrompt("Enter list name:");
        if (title) {
            await createList(title);
        }
    });

    board.appendChild(addListCard);
}

async function createTask(title, listId) {
    try {
        const task = await fetchJSON(API_TASKS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, list_id: listId })
        });
        const el = createCardElement(task);
        const parent = document.getElementById(`list-${task.list_id}`);
        if (parent) parent.prepend(el);
    } catch (err) {
        alert(err.error || "uh oh an error, and i didnt write code to catch the error so this is all u get");
    }
}

async function createList(title) {
    try {
        await fetchJSON(API_LISTS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title })
        });
        await loadAndRender();
    } catch (err) {
        alert(err.error || "uh oh an error, and i didnt write code to catch the error so this is all u get");
    }
}

document.getElementById("add-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.querySelector(".new-title");
    const title = input.value.trim();
    if (!title) return;

    if (currentValue === null) {
        alert("Please select a status");
        return;
    }

    await createTask(title, currentValue);

    input.value = "";
    selectedSpan.textContent = "Select status";
    currentValue = null;
});

loadAndRender();
