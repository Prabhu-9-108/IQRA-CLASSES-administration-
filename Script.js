// --- State Management ---
const DB_KEY = 'iqra_data_v1';
let db = {
    students: [],
    fees: [],
    expenses: [],
    staff: []
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    if(document.getElementById('fee-date')) document.getElementById('fee-date').value = today;
    if(document.getElementById('exp-date')) document.getElementById('exp-date').value = today;
    
    // Set current date in header
    const dateEl = document.getElementById('current-date');
    if(dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    router('dashboard'); // Default view
});

// --- Data Persistence ---
function loadData() {
    const saved = localStorage.getItem(DB_KEY);
    if (saved) {
        db = JSON.parse(saved);
        // Schema update for old data
        if(db.students) {
            db.students.forEach(s => {
                if(!s.parentName) s.parentName = '';
            });
        }
    }
    refreshAll();
}

function saveData() {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    refreshAll();
}

function backupData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "iqra_backup_" + new Date().toISOString().split('T')[0] + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// --- Router ---
function router(viewName) {
    // Hide all views
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    // Show selected view
    const view = document.getElementById(`view-${viewName}`);
    if(view) view.classList.remove('hidden');
    
    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('bg-slate-800', 'text-white');
        el.classList.add('text-slate-300');
    });
    const activeNav = document.getElementById(`nav-${viewName}`);
    if(activeNav) {
        activeNav.classList.add('bg-slate-800', 'text-white');
        activeNav.classList.remove('text-slate-300');
    }

    // Mobile sidebar logic
    if(window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if(sidebar) sidebar.classList.add('-translate-x-full');
        if(overlay) overlay.classList.add('hidden');
    }

    // View specific refreshes
    if(viewName === 'reports') renderCharts();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
}

function refreshAll() {
    updateDashboardStats();
    renderStudentTable();
    populateStudentSelect();
    renderFeeTable();
    renderExpenseTable();
    renderStaffGrid();
}

// --- Dashboard Logic ---
function updateDashboardStats() {
    // Counts
    const totalStudentsEl = document.getElementById('dash-total-students');
    if(totalStudentsEl) totalStudentsEl.textContent = db.students.length;
    
    // Financials for current month
    const currentMonthIndex = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let income = 0;
    db.fees.forEach(f => {
        const d = new Date(f.date);
        if(d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear) {
            income += parseFloat(f.amount);
        }
    });

    let expense = 0;
    db.expenses.forEach(e => {
        const d = new Date(e.date);
        if(d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear) {
            expense += parseFloat(e.amount);
        }
    });

    const incomeEl = document.getElementById('dash-income');
    const expenseEl = document.getElementById('dash-expense');
    const profitEl = document.getElementById('dash-profit');

    if(incomeEl) incomeEl.textContent = `₹${income.toLocaleString()}`;
    if(expenseEl) expenseEl.textContent = `₹${expense.toLocaleString()}`;
    if(profitEl) profitEl.textContent = `₹${(income - expense).toLocaleString()}`;

    // Recent Transactions (Combine Fees and Expenses)
    const transactions = [
        ...db.fees.map(f => ({ ...f, type: 'Fee', category: 'Fee Collection', desc: `Fee from ${getStudentName(f.studentId)}` })),
        ...db.expenses.map(e => ({ ...e, type: 'Expense', desc: e.title }))
    ].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    const tbody = document.getElementById('dash-transactions-body');
    if(tbody) {
        if(transactions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">No recent transactions</td></tr>`;
        } else {
            tbody.innerHTML = transactions.map(t => `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-3 text-gray-500">${new Date(t.date).toLocaleDateString()}</td>
                    <td class="px-6 py-3 font-medium text-gray-800">${t.desc}</td>
                    <td class="px-6 py-3">
                        <span class="px-2 py-1 text-xs rounded-full ${t.type === 'Fee' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                            ${t.category || 'Expense'}
                        </span>
                    </td>
                    <td class="px-6 py-3 text-right font-bold ${t.type === 'Fee' ? 'text-green-600' : 'text-red-600'}">
                        ${t.type === 'Fee' ? '+' : '-'} ₹${parseFloat(t.amount).toLocaleString()}
                    </td>
                </tr>
            `).join('');
        }
    }
}

// --- Students Logic ---
function handleAddStudent(e) {
    e.preventDefault();
    const form = e.target;
    const newStudent = {
        id: Date.now().toString(),
        name: form.name.value,
        roll: form.roll.value,
        parentName: form.parentName.value || '',
        batch: form.batch.value,
        phone: form.phone.value,
        address: form.address.value,
        status: 'Active',
        joined: new Date().toISOString()
    };
    db.students.push(newStudent);
    saveData();
    closeModal('modal-student');
    form.reset();
    alert('Student added successfully!');
}

function renderStudentTable() {
    const searchEl = document.getElementById('search-student');
    const search = searchEl ? searchEl.value.toLowerCase() : '';
    const tbody = document.getElementById('students-table-body');
    if(!tbody) return;
    
    const filtered = db.students.filter(s => 
        s.name.toLowerCase().includes(search) || 
        s.roll.toLowerCase().includes(search) ||
        s.batch.toLowerCase().includes(search)
    );

    if(filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-400">No students found</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(s => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4 font-mono text-xs text-gray-500">${s.roll}</td>
            <td class="px-6 py-4 font-bold text-gray-800">${s.name}</td>
            <td class="px-6 py-4 text-gray-600">${s.batch}</td>
            <td class="px-6 py-4 text-gray-600">${s.phone}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Active</span>
            </td>
            <td class="px-6 py-4 text-right space-x-2">
                <button onclick="viewStudentDetails('${s.id}')" class="text-blue-500 hover:text-blue-700 transition-colors" title="View Details">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button onclick="deleteStudent('${s.id}')" class="text-red-500 hover:text-red-700 transition-colors" title="Delete">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function viewStudentDetails(id) {
    const s = db.students.find(x => x.id === id);
    if(!s) return;

    // Populate Info
    document.getElementById('detail-name').textContent = s.name;
    document.getElementById('detail-roll').textContent = s.roll;
    document.getElementById('detail-batch').textContent = s.batch;
    document.getElementById('detail-parent').textContent = s.parentName || 'N/A';
    document.getElementById('detail-phone').textContent = s.phone;
    document.getElementById('detail-address').textContent = s.address || 'N/A';
    document.getElementById('detail-joined').textContent = new Date(s.joined).toLocaleDateString();

    // Populate Fees
    const studentFees = db.fees.filter(f => f.studentId === id).sort((a,b) => new Date(b.date) - new Date(a.date));
    const feeBody = document.getElementById('detail-fee-body');
    
    if(studentFees.length === 0) {
        feeBody.innerHTML = '<tr><td colspan="4" class="p-3 text-center text-gray-500">No fee records found</td></tr>';
    } else {
        feeBody.innerHTML = studentFees.map(f => `
            <tr class="border-b">
                <td class="p-2">${new Date(f.date).toLocaleDateString()}</td>
                <td class="p-2">${f.month}</td>
                <td class="p-2">${f.mode}</td>
                <td class="p-2 text-right font-bold text-green-600">₹${parseInt(f.amount).toLocaleString()}</td>
            </tr>
        `).join('');
    }

    openModal('modal-student-details');
}

function deleteStudent(id) {
    if(confirm('Are you sure? This will remove the student but keep their financial records.')) {
        db.students = db.students.filter(s => s.id !== id);
        saveData();
    }
}

function getStudentName(id) {
    const s = db.students.find(x => x.id === id);
    return s ? s.name : 'Unknown Student';
}

// --- Fees Logic ---
function populateStudentSelect() {
    const select = document.getElementById('fee-student-select');
    if(!select) return;
    select.innerHTML = `<option value="">Choose a student...</option>` + 
        db.students.map(s => `<option value="${s.id}">${s.name} (${s.roll}) - ${s.batch}</option>`).join('');
}

function handleFeeSubmit(e) {
    e.preventDefault();
    const studentId = document.getElementById('fee-student-select').value;
    if(!studentId) { alert('Please select a student'); return; }

    const newFee = {
        id: Date.now().toString(),
        studentId: studentId,
        amount: document.getElementById('fee-amount').value,
        month: document.getElementById('fee-month').value,
        date: document.getElementById('fee-date').value,
        mode: document.getElementById('fee-mode').value
    };
    db.fees.push(newFee);
    saveData();
    document.getElementById('fee-amount').value = '';
    alert('Fee Recorded!');
}

function renderFeeTable() {
    const tbody = document.getElementById('fees-table-body');
    if(!tbody) return;
    const sorted = [...db.fees].sort((a,b) => new Date(b.date) - new Date(a.date));

    if(sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-400">No fee records found</td></tr>`;
        return;
    }

    tbody.innerHTML = sorted.map(f => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-3 text-gray-500">${new Date(f.date).toLocaleDateString()}</td>
            <td class="px-6 py-3 font-medium text-gray-800">${getStudentName(f.studentId)}</td>
            <td class="px-6 py-3 text-gray-600">${f.month}</td>
            <td class="px-6 py-3 text-xs text-gray-500 uppercase">${f.mode}</td>
            <td class="px-6 py-3 text-right font-bold text-green-600">₹${parseFloat(f.amount).toLocaleString()}</td>
            <td class="px-6 py-3 text-right">
                <button onclick="deleteFee('${f.id}')" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function deleteFee(id) {
    if(confirm('Delete this fee record?')) {
        db.fees = db.fees.filter(f => f.id !== id);
        saveData();
    }
}

// --- Expenses Logic ---
function handleExpenseSubmit(e) {
    e.preventDefault();
    const newExp = {
        id: Date.now().toString(),
        title: document.getElementById('exp-title').value,
        category: document.getElementById('exp-category').value,
        amount: document.getElementById('exp-amount').value,
        date: document.getElementById('exp-date').value
    };
    db.expenses.push(newExp);
    saveData();
    document.getElementById('exp-title').value = '';
    document.getElementById('exp-amount').value = '';
    alert('Expense Recorded!');
}

function renderExpenseTable() {
    const tbody = document.getElementById('expenses-table-body');
    if(!tbody) return;
    const sorted = [...db.expenses].sort((a,b) => new Date(b.date) - new Date(a.date));

    if(sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-400">No expenses recorded</td></tr>`;
        return;
    }

    tbody.innerHTML = sorted.map(e => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-3 text-gray-500">${new Date(e.date).toLocaleDateString()}</td>
            <td class="px-6 py-3 font-medium text-gray-800">${e.title}</td>
            <td class="px-6 py-3"><span class="bg-red-50 text-red-700 px-2 py-1 rounded-md text-xs">${e.category}</span></td>
            <td class="px-6 py-3 text-right font-bold text-red-600">₹${parseFloat(e.amount).toLocaleString()}</td>
            <td class="px-6 py-3 text-right">
                <button onclick="deleteExpense('${e.id}')" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function deleteExpense(id) {
    if(confirm('Delete this expense?')) {
        db.expenses = db.expenses.filter(e => e.id !== id);
        saveData();
    }
}

// --- Staff Logic ---
function handleAddStaff(e) {
    e.preventDefault();
    const form = e.target;
    const newStaff = {
        id: Date.now().toString(),
        name: form.name.value,
        role: form.role.value,
        phone: form.phone.value,
        salary: form.salary.value,
        joined: new Date().toISOString()
    };
    db.staff.push(newStaff);
    saveData();
    closeModal('modal-staff');
    form.reset();
}

function renderStaffGrid() {
    const grid = document.getElementById('staff-grid');
    if(!grid) return;
    if(db.staff.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center text-gray-400 py-10">No staff members added</div>`;
        return;
    }

    grid.innerHTML = db.staff.map(s => `
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center text-center relative hover:shadow-md transition-shadow">
            <button onclick="deleteStaff('${s.id}')" class="absolute top-4 right-4 text-gray-300 hover:text-red-500"><i class="fa-solid fa-trash"></i></button>
            <div class="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">
                ${s.name.charAt(0)}
            </div>
            <h3 class="font-bold text-gray-800 text-lg">${s.name}</h3>
            <p class="text-purple-600 text-sm font-medium mb-2">${s.role}</p>
            <div class="w-full border-t border-gray-100 my-3 pt-3 flex justify-between text-sm text-gray-600">
                <span><i class="fa-solid fa-phone mr-1"></i> ${s.phone}</span>
                <span>₹${parseInt(s.salary).toLocaleString()}/mo</span>
            </div>
        </div>
    `).join('');
}

function deleteStaff(id) {
    if(confirm('Remove this staff member?')) {
        db.staff = db.staff.filter(s => s.id !== id);
        saveData();
    }
}

// --- Modal Logic ---
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// --- Charts Logic ---
let financeChart = null;
let expenseChart = null;

function renderCharts() {
    // Data Prep
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const incomeData = new Array(12).fill(0);
    const expenseData = new Array(12).fill(0);
    const currentYear = new Date().getFullYear();

    db.fees.forEach(f => {
        const d = new Date(f.date);
        if(d.getFullYear() === currentYear) incomeData[d.getMonth()] += parseFloat(f.amount);
    });
    db.expenses.forEach(e => {
        const d = new Date(e.date);
        if(d.getFullYear() === currentYear) expenseData[d.getMonth()] += parseFloat(e.amount);
    });

    // Expense Categories
    const categories = {};
    db.expenses.forEach(e => {
        categories[e.category] = (categories[e.category] || 0) + parseFloat(e.amount);
    });

    // Render Income vs Expense
    const ctx1 = document.getElementById('financeChart').getContext('2d');
    if(financeChart) financeChart.destroy();
    financeChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                { label: 'Income', data: incomeData, backgroundColor: '#22c55e', borderRadius: 4 },
                { label: 'Expenses', data: expenseData, backgroundColor: '#ef4444', borderRadius: 4 }
            ]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });

    // Render Expense Category
    const ctx2 = document.getElementById('expenseCategoryChart').getContext('2d');
    if(expenseChart) expenseChart.destroy();
    expenseChart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categories),
            datasets: [{
                data: Object.values(categories),
                backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#14b8a6', '#6366f1']
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'right' } } }
    });
}
