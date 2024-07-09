import React, { useState, useEffect, useCallback } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import Chart from 'chart.js/auto';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import { faBars, faSignOutAlt, faEdit, faTrash ,faFileExcel} from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx';


import './App.css';

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBEaewAHZQ3R6H0FNCryNzpZVik1tFJQ5w",
  authDomain: "moneysprint-6e195.firebaseapp.com",
  projectId: "moneysprint-6e195",
  storageBucket: "moneysprint-6e195.appspot.com",
  messagingSenderId: "676782706866",
  appId: "1:676782706866:web:7cc2b972a82ed1959ab9ab",
  measurementId: "G-4MX8HX1Z88"
};

firebase.initializeApp(firebaseConfig);
const firestore = firebase.firestore();
const auth = firebase.auth();

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const speechRecognition = new SpeechRecognition();

const ExpenseTracker = () => {
  const [user, setUser] = useState(null);
  const [expense, setExpense] = useState({
    amount: '',
    category: '',
    date: '',
  });
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [dateRange, setDateRange] = useState('1 day');
  const [error, setError] = useState(null);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [updatedExpense, setUpdatedExpense] = useState({
    amount: '',
    category: '',
    date: '',
  });

  // Check if user is already signed in on component mount
  useEffect(() => {
    const userData = localStorage.getItem('expense_tracker_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const fetchCategories = useCallback(() => {
    if (!user) return;
    firestore
      .collection('users')
      .doc(user.uid)
      .collection('categories')
      .get()
      .then((querySnapshot) => {
        const data = querySnapshot.docs.map((doc) => doc.data().name);
        setCategories(data);
      })
      .catch((error) => {
        console.error('Error fetching categories: ', error);
      });
  }, [user]);

  const fetchExpenses = useCallback(() => {
    if (!user) return;
    let startDate = new Date();
    if (dateRange === '1 day') {
      startDate.setDate(startDate.getDate() - 1);
    } else if (dateRange === '1 week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (dateRange === '1 month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (dateRange === '1 year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }

    firestore
      .collection('users')
      .doc(user.uid)
      .collection('expenses')
      .where('date', '>=', startDate.toISOString())
      .get()
      .then((querySnapshot) => {
        const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setExpenses(data);
      })
      .catch((error) => {
        console.error('Error fetching expenses: ', error);
      });
  }, [user, dateRange]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchCategories();
      fetchExpenses();
    }
  }, [user, fetchCategories, fetchExpenses]);

  const renderChart = useCallback(() => {
    if (!user) return;
    const ctx = document.getElementById('expense-chart').getContext('2d');
  
    const categoryExpenses = expenses.reduce((acc, expense) => {
      if (!acc[expense.category]) {
        acc[expense.category] = 0;
      }
      acc[expense.category] += parseFloat(expense.amount);
      return acc;
    }, {});
  
    const labels = Object.keys(categoryExpenses);
    const amounts = Object.values(categoryExpenses);
  
    if (window.expenseChart) {
      window.expenseChart.destroy();
    }
  
    window.expenseChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Total Amount Spent',
            data: amounts,
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Total Expense Amount (INR)',
            },
          },
          x: {
            title: {
              display: true,
              text: 'Category',
            },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const value = context.parsed.y || 0;
                return label + ': ' + value;
              },
            },
          },
        },
      },
    });
  }, [expenses, user]);

  useEffect(() => {
    if (user) {
      renderChart();
    }
  }, [expenses, renderChart, user]);
  
const handleSpeechInput = () => {
  if (!speechRecognition) return;

  speechRecognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      console.log('Transcript:', transcript);
    
      const words = transcript.split(' ');
      if (words.length < 4) {
          console.error('Invalid speech input format.');
          return;
      }

      const amountIndex = words.findIndex(word => !isNaN(parseInt(word))); // Find the first word that is a number
      const categoryIndex =  words.findIndex((word, index) => index > amountIndex && isNaN(parseInt(word))); // Find the first word after the amount that is not a number

      if (amountIndex === -1 || categoryIndex === -1) {
          console.error('Invalid speech input format.');
          return;
      }

      const amount = parseInt(words[amountIndex]);
      const category = words.slice(categoryIndex).join(' ');

      // Set the date to today's date
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0];

      // Check if the category is already in the list, if not, prompt the user to add it
      if (!categories.includes(category)) {
          const confirmCategoryAddition = window.confirm(`The category "${category}" is not in the list. Do you want to add it?`);
          if (confirmCategoryAddition) {
              // Add the new category to the list
              setCategories(prevCategories => [...prevCategories, category]);
          } else {
              console.error('Category not found in the list.');
              return;
          }
      }

      // Add the expense using the extracted details
      addExpense({ amount, category, date: formattedDate });
  };

  speechRecognition.start(); // Start listening
};



  
  const addExpense = ({ amount, category, date }) => {
    if (!user) return;
    firestore
      .collection('users')
      .doc(user.uid)
      .collection('expenses')
      .add({ amount, category, date })
      .then(() => {
        fetchExpenses();
        setExpense({ amount: '', category: '', date: '' });
        setError(null);
      })
      .catch((error) => {
        console.error('Error adding expense: ', error);
      });
  };
  
  
  const handleExpenseSubmit = (e) => {
    e.preventDefault();
    if (!expense.amount || !expense.category || !expense.date) {
      setError('All fields are required');
      return;
    }
    if (!newCategory && expense.category === '__new__') {
      setError('Category name cannot be empty');
      return;
    }

    firestore
      .collection('users')
      .doc(user.uid)
      .collection('expenses')
      .add(expense)
      .then(() => {
        fetchExpenses();
        setExpense({ amount: '', category: '', date: '' });
        setError(null);
      })
      .catch((error) => {
        console.error('Error adding expense: ', error);
      });
  };

  const handleCategoryChange = (e) => {
    const selectedCategory = e.target.value;
    if (selectedCategory === '__new__') {
      setNewCategory('');
      setExpense({ ...expense, category: selectedCategory });
    } else {
      setExpense({ ...expense, category: selectedCategory });
    }
  };

  const handleNewCategoryChange = (e) => {
    setNewCategory(e.target.value);
    setError(null);
  };

  const handleNewCategorySubmit = () => {
    if (!newCategory) {
      setError('Category name cannot be empty');
      return;
    }
  
    // Check if the new category already exists
    if (categories.includes(newCategory)) {
      setError('Category already exists');
      return;
    }
  
    // Add the new category
    firestore
      .collection('users')
      .doc(user.uid)
      .collection('categories')
      .add({ name: newCategory })
      .then(() => {
        fetchCategories();
        setNewCategory('');
        setError(null);
      })
      .catch((error) => {
        console.error('Error adding new category: ', error);
      });
  };
  
  
  const toggleNav = () => {
    setIsNavOpen(!isNavOpen);
  };

  const handleDateRangeChange = (e) => {
    setDateRange(e.target.value);
  };

  const deleteExpense = (id) => {
    firestore
      .collection('users')
      .doc(user.uid)
      .collection('expenses')
      .doc(id)
      .delete()
      .then(() => {
        setExpenses(expenses.filter((expense) => expense.id !== id));
      })
      .catch((error) => {
        console.error('Error deleting expense: ', error);
      });
  };

  const handleEditExpense = (id) => {
    setEditingExpenseId(id);
  };

  const handleSaveExpense = (id) => {
    firestore
      .collection('users')
      .doc(user.uid)
      .collection('expenses')
      .doc(id)
      .update(updatedExpense)
      .then(() => {
        const updatedExpenses = expenses.map((expense) => (expense.id === id ? updatedExpense : expense));
        setExpenses(updatedExpenses);
        setEditingExpenseId(null);
      })
      .catch((error) => {
        console.error('Error updating expense:', error);
      });
  };

  // Function to sign in user
  const signIn = async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
    } catch (error) {
      console.error('Error signing in: ', error);
    }
  };

  // Function to sign out user
  const signOut = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem('expense_tracker_user'); // Remove user data from local storage
      setUser(null); // Reset user state
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  // Redirect user after successful sign-in
  useEffect(() => {
    if (user) {
      localStorage.setItem('expense_tracker_user', JSON.stringify(user)); // Store user data in local storage
      // Redirect user to home page or dashboard after sign-in
      // For example: window.location.href = '/';
    }
  }, [user]);

  const exportDataAsExcel = () => {
    const dataToExport = expenses.map(expense => ({
      Amount: expense.amount,
      Category: expense.category,
      Date: expense.date
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');

    XLSX.writeFile(workbook, 'expenses.xlsx');
  };

  

  return (
    <div>
      {user ? (
        <div>
          <nav className={`navbar ${isNavOpen ? 'open' : ''}`}>
          <div className="navbar-toggle" onClick={toggleNav}>
              <FontAwesomeIcon icon={faBars} />
            </div>
            <ul className={`navbar-menu ${isNavOpen ? 'open' : ''}`}>
              <li>Home</li>
              <li>About</li>
              <li>Contact</li>
              <li><button onClick={exportDataAsExcel}>
              <FontAwesomeIcon icon={faFileExcel} />
              Export as Excel
            </button></li>
            </ul>
            {user && (
              <button onClick={signOut} className="sign-out-btn">
              <FontAwesomeIcon icon={faSignOutAlt} />
              Sign out
            </button>
            )}
          </nav>
          <div className="container">
            <h2>MoneySprint</h2>
            {error && <div className="error">{error}</div>}
            <form onSubmit={handleExpenseSubmit}>
              <label>
                Amount:
                <input type="number" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} />
              </label>
              <label>
                Category:
                <select value={expense.category} onChange={handleCategoryChange}>
                  <option value="">Select category...</option>
                  {categories.map((category, index) => (
                    <option key={index} value={category}>
                      {category}
                    </option>
                  ))}
                  <option value="__new__">Add New Category...</option>
                </select>
                {expense.category === '__new__' && (
                  <div>
                    <input type="text" value={newCategory} onChange={handleNewCategoryChange} placeholder="Enter new category..." />
                    <button type="button" onClick={handleNewCategorySubmit}>
                      Add
                    </button>
                  </div>
                )}
              </label>
              <label>
                Date:
                <input type="date" value={expense.date} onChange={(e) => setExpense({ ...expense, date: e.target.value })} />
              </label>
              <h3>Try: add rs 100 insurance</h3>
              <button type="button" onClick={handleSpeechInput}>
                Add Expense via Speech
                <span className="tooltip">Click and start speaking to add an expense</span>
              </button>
              <button type="submit">Add Expense</button>
            </form>

            <div className="expense-list">
              <h3>Expenses:</h3>
              {expenses.map((expense) => (
                <div key={expense.id} className="expense-card">
                  <div>
                    <strong>Amount:</strong> ₹{expense.amount}
                  </div>
                  <div>
                    <strong>Category:</strong> {expense.category}
                  </div>
                  <div>
                    <strong>Date:</strong> {expense.date}
                  </div>
                  {editingExpenseId === expense.id ? (
                    <>
                      <input type="number" value={updatedExpense.amount} onChange={(e) => setUpdatedExpense({ ...updatedExpense, amount: e.target.value })} />
                      <input type="text" value={updatedExpense.category} onChange={(e) => setUpdatedExpense({ ...updatedExpense, category: e.target.value })} />
                      <input type="date" value={updatedExpense.date} onChange={(e) => setUpdatedExpense({ ...updatedExpense, date: e.target.value })} />
                      <button onClick={() => handleSaveExpense(expense.id)}>Save</button>
                    </>
                  ) : (
                    <FontAwesomeIcon icon={faEdit} onClick={() => handleEditExpense(expense.id)} className="edit-icon" />
                  )}<span style={{ marginRight: '10px' }}></span>
                  <FontAwesomeIcon icon={faTrash} onClick={() => deleteExpense(expense.id)} className="delete-icon" />
                </div>
              ))}
            </div>

            <div className="date-range-filter">
              <label>Select Date Range:</label>
              <select value={dateRange} onChange={handleDateRangeChange}>
                <option value="1 day">1 Day</option>
                <option value="1 week">1 Week</option>
                <option value="1 month">1 Month</option>
                <option value="1 year">1 Year</option>
              </select>
            </div>

            <div className="chart-container">
              <canvas id="expense-chart"></canvas>
            </div>
          </div>
        </div>
      ) : (
        <div className="center-container">
          <div className="center-content">
            <button onClick={signIn} className="google-signin-btn">
              <FontAwesomeIcon icon={faGoogle} />
              Sign in with Google
            </button>
            <div>Please sign in to access the Expense Tracker.</div>
          </div>
        </div>      
      )}
    </div>
  );
};

export default ExpenseTracker;
