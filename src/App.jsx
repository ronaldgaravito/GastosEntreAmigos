import { useState, useEffect } from 'react'
import { Plus, Users, History, Calculator, Receipt, Trash2 } from 'lucide-react'
import { supabase } from './lib/supabase'
import './App.css'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [friends, setFriends] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    paid_by: '',
    split_with: []
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: friendsData } = await supabase.from('friends').select('*')
    const { data: expensesData } = await supabase.from('expenses').select('*, paid_by(name)').order('created_at', { ascending: false })
    
    setFriends(friendsData || [])
    setExpenses(expensesData || [])
    setLoading(false)
  }

  async function addFriend(name) {
    if (!name) return
    const { data, error } = await supabase.from('friends').insert([{ name }]).select()
    if (!error) {
      setFriends([...friends, ...data])
    }
  }

  async function deleteFriend(id) {
    if (!confirm('¿Estás seguro de eliminar a este amigo? Se perderán sus gastos asociados.')) return
    const { error } = await supabase.from('friends').delete().eq('id', id)
    if (!error) {
      fetchData()
    }
  }

  async function deleteExpense(id) {
    if (!confirm('¿Estás seguro de eliminar este gasto?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (!error) {
      fetchData()
    }
  }

  async function handleAddExpense(e) {
    e.preventDefault()
    const { description, amount, paid_by, split_with } = newExpense
    
    if (!description || !amount || !paid_by || split_with.length === 0) {
      alert('Por favor rellena todos los campos')
      return
    }

    // 1. Create the expense
    const { data: expenseData, error: expError } = await supabase
      .from('expenses')
      .insert([{ description, amount: parseFloat(amount), paid_by }])
      .select()

    if (expError) {
      alert('Error creando gasto')
      return
    }

    const expenseId = expenseData[0].id
    const splitAmount = parseFloat(amount) / split_with.length

    // 2. Create the splits
    const splits = split_with.map(friendId => ({
      expense_id: expenseId,
      friend_id: friendId,
      amount: splitAmount
    }))

    const { error: splitError } = await supabase.from('expense_splits').insert(splits)

    if (splitError) {
      alert('Error creando repartición')
    } else {
      setShowAddExpense(false)
      setNewExpense({ description: '', amount: '', paid_by: '', split_with: [] })
      fetchData()
    }
  }

  async function calculateBalances() {
    const { data: splitsData } = await supabase.from('expense_splits').select('*')
    
    const balances = {}
    friends.forEach(f => balances[f.id] = { name: f.name, amount: 0 })

    // Expenses paid by the user
    expenses.forEach(exp => {
      const payerId = exp.paid_by?.id || exp.paid_by
      if (balances[payerId]) {
        balances[payerId].amount += parseFloat(exp.amount)
      }
    })

    // Substract what they owe (splits)
    splitsData?.forEach(split => {
      if (balances[split.friend_id]) {
        balances[split.friend_id].amount -= parseFloat(split.amount)
      }
    })

    return Object.values(balances)
  }

  const [balanceList, setBalanceList] = useState([])

  useEffect(() => {
    if (!loading && friends.length > 0) {
      calculateBalances().then(setBalanceList)
    }
  }, [loading, friends, expenses])

  if (!isLoggedIn) {
    return (
      <div className="login-container animate-fade">
        <div className="glass-card login-card">
          <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 className="gradient-text" style={{ fontSize: '2.5rem' }}>Bienvenido</h1>
            <p style={{ color: 'var(--text-muted)' }}>Inicia sesión para gestionar tus gastos</p>
          </header>
          
          <form onSubmit={(e) => { e.preventDefault(); setIsLoggedIn(true); }}>
            <div className="input-group">
              <label>Email</label>
              <input type="email" placeholder="tu@email.com" />
            </div>
            <div className="input-group">
              <label>Contraseña</label>
              <input type="password" placeholder="••••••••" />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '1rem' }}>
              Entrar
            </button>
          </form>
          
          <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            ¿No tienes cuenta? <span style={{ color: 'white', cursor: 'pointer' }}>Regístrate</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="App">
      <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
        <button 
          onClick={() => setIsLoggedIn(false)}
          className="btn-secondary" 
          style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
        >
          Cerrar Sesión
        </button>
      </div>
      <header className="glass-card" style={{ marginBottom: '1rem' }}>
        <h1 className="gradient-text">Dividir Gastos</h1>
        <p style={{ color: 'var(--text-muted)' }}>Viajes, cenas y compartidos</p>
      </header>

      <div className="debt-summary">
        {balanceList.map(b => (
          <div key={b.name} className="glass-card debt-card animate-fade">
            <Calculator size={20} color={b.amount >= 0 ? '#ffffff' : '#666666'} />
            <h4 style={{ margin: '0.5rem 0' }}>{b.name}</h4>
            <p className={b.amount >= 0 ? 'amount' : 'amount negative'}>
              {b.amount >= 0 ? `Le deben: $${b.amount.toFixed(2)}` : `Debe: $${Math.abs(b.amount).toFixed(2)}`}
            </p>
          </div>
        ))}
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2><History size={20} /> Historial</h2>
          <button className="btn-primary" onClick={() => setShowAddExpense(true)}>
            <Plus size={20} /> Nuevo Gasto
          </button>
        </div>

        {loading ? (
          <p>Cargando...</p>
        ) : expenses.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay gastos registrados</p>
        ) : (
          expenses.map(exp => (
            <div key={exp.id} className="expense-item animate-fade">
              <div>
                <strong>{exp.description}</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Pagado por: {exp.paid_by?.name || 'Desconocido'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="amount">${exp.amount}</div>
                <button 
                  onClick={() => deleteExpense(exp.id)}
                  style={{ background: 'transparent', color: 'var(--text-muted)', padding: '0.2rem' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddExpense && (
        <div className="modal-overlay">
          <div className="glass-card" style={{ width: '90%', maxWidth: '400px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Agregar Gasto</h2>
            <form onSubmit={handleAddExpense}>
              <div className="input-group">
                <label>Descripción</label>
                <input 
                  type="text" 
                  value={newExpense.description}
                  onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                  placeholder="Ej: Cena pizza"
                />
              </div>
              <div className="input-group">
                <label>Monto</label>
                <input 
                  type="number" 
                  value={newExpense.amount}
                  onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              <div className="input-group">
                <label>Pagado por</label>
                <select 
                  value={newExpense.paid_by}
                  onChange={e => setNewExpense({...newExpense, paid_by: e.target.value})}
                >
                  <option value="">Selecciona...</option>
                  {friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              
              <div className="input-group">
                <label>Dividir entre</label>
                <div className="checkbox-group">
                  {friends.map(f => (
                    <div key={f.id} className="checkbox-item">
                      <input 
                        type="checkbox"
                        checked={newExpense.split_with.includes(f.id)}
                        onChange={e => {
                          const updated = e.target.checked 
                            ? [...newExpense.split_with, f.id]
                            : newExpense.split_with.filter(id => id !== f.id)
                          setNewExpense({...newExpense, split_with: updated})
                        }}
                      />
                      {f.name}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Guardar</button>
                <button type="button" onClick={() => setShowAddExpense(false)} className="btn-secondary" style={{ flex: 1 }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2><Users size={20} /> Amigos</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input id="friend-name" type="text" placeholder="Nombre del amigo" />
          <button className="btn-primary" onClick={() => {
            const input = document.getElementById('friend-name')
            addFriend(input.value)
            input.value = ''
          }}><Plus size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {friends.map(f => (
            <span key={f.id} className="glass-card friend-tag animate-fade">
              {f.name}
              <button 
                onClick={() => deleteFriend(f.id)}
                style={{ background: 'transparent', color: 'rgba(255,255,255,0.3)', padding: '0 0 0 0.5rem', fontSize: '1rem' }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
