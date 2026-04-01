import { useState, useEffect } from 'react'
import { Plus, Users, History, Calculator, Receipt, Trash2, Layout, Calendar, ChevronRight, LogOut, Utensils, Car, Home, Beer, ShoppingBag, Tag, Download, PieChart as PieChartIcon, Edit3 } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import './App.css'

const CATEGORIES = {
  'Comida': { icon: <Utensils size={16} />, color: '#FF6B6B' },
  'Transporte': { icon: <Car size={16} />, color: '#4D96FF' },
  'Alojamiento': { icon: <Home size={16} />, color: '#6BCB77' },
  'Entretenimiento': { icon: <Beer size={16} />, color: '#FFD93D' },
  'Compras': { icon: <ShoppingBag size={16} />, color: '#9D50BB' },
  'Otros': { icon: <Tag size={16} />, color: '#666666' }
}

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-ES', { 
    day: 'numeric', 
    month: 'short', 
    hour: '2-digit', 
    minute: '2-digit' 
  }).format(date);
}

function App() {
  const [session, setSession] = useState(null)
  const [groups, setGroups] = useState([])
  const [currentGroupId, setCurrentGroupId] = useState(null)
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [friends, setFriends] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    paid_by: '',
    category: 'Otros',
    split_with: []
  })
  const [editingExpense, setEditingExpense] = useState(null)
  const [payments, setPayments] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchData() {
    if (!session?.user) return
    setLoading(true)
    
    const { data: groupsData } = await supabase
      .from('groups')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      
    setGroups(groupsData || [])

    if (groupsData?.length > 0 && !currentGroupId) {
      setCurrentGroupId(groupsData[0].id)
    }

    if (currentGroupId) {
      const { data: friendsData } = await supabase.from('friends').select('*').eq('group_id', currentGroupId)
      const { data: expensesData } = await supabase.from('expenses')
        .select('*, paid_by(id, name)')
        .eq('group_id', currentGroupId)
        .order('created_at', { ascending: false })
      
      const { data: paymentsData } = await supabase.from('payments')
        .select('*, from_id(id, name), to_id(id, name)')
        .eq('group_id', currentGroupId)
        .order('created_at', { ascending: false })

      setFriends(friendsData || [])
      setExpenses(expensesData || [])
      setPayments(paymentsData || [])
    } else {
      setFriends([])
      setExpenses([])
      setPayments([])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (session) {
      fetchData()
    }
  }, [currentGroupId, session])

  async function addGroup(e) {
    e.preventDefault()
    if (!newGroupName || !session?.user) return
    const { data, error } = await supabase
      .from('groups')
      .insert([{ name: newGroupName, user_id: session.user.id }])
      .select()
      
    if (error) {
      alert('Error creando sala: ' + error.message)
    } else {
      setGroups([data[0], ...groups])
      setCurrentGroupId(data[0].id)
      setNewGroupName('')
      setShowAddGroup(false)
    }
  }

  async function deleteGroup(id) {
    if (!confirm('¿Eliminar esta sala? Se perderá todo su contenido.')) return
    const { error } = await supabase.from('groups').delete().eq('id', id)
    if (!error) {
      if (currentGroupId === id) setCurrentGroupId(null)
      fetchData()
    }
  }

  async function addFriend(name) {
    if (!name || !currentGroupId) return
    const { data, error } = await supabase.from('friends').insert([{ name, group_id: currentGroupId }]).select()
    if (error) {
      alert('Error añadiendo amigo: ' + error.message)
    } else {
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
    const { description, amount, paid_by, category, split_with } = newExpense
    
    if (!description || !amount || !paid_by || split_with.length === 0) {
      alert('Por favor rellena todos los campos')
      return
    }

    let expenseId;
    if (editingExpense) {
      // Actualizar gasto existente
      const { error: expError } = await supabase
        .from('expenses')
        .update({ 
          description, 
          amount: parseFloat(amount), 
          paid_by, 
          category 
        })
        .eq('id', editingExpense.id)

      if (expError) {
        alert('Error editando gasto: ' + expError.message)
        return
      }
      
      expenseId = editingExpense.id
      // Eliminar reparticiones antiguas
      await supabase.from('expense_splits').delete().eq('expense_id', expenseId)
    } else {
      // Crear nuevo gasto
      const { data: expenseData, error: expError } = await supabase
        .from('expenses')
        .insert([{ 
          description, 
          amount: parseFloat(amount), 
          paid_by, 
          category,
          group_id: currentGroupId 
        }])
        .select()

      if (expError) {
        alert('Error creando gasto: ' + expError.message)
        return
      }
      expenseId = expenseData[0].id
    }

    const splitAmount = parseFloat(amount) / split_with.length
    const splits = split_with.map(friendId => ({
      expense_id: expenseId,
      friend_id: friendId,
      amount: splitAmount
    }))

    const { error: splitError } = await supabase.from('expense_splits').insert(splits)

    if (splitError) {
      alert('Error creando repartición: ' + splitError.message)
    } else {
      setShowAddExpense(false)
      setEditingExpense(null)
      setNewExpense({ description: '', amount: '', paid_by: '', category: 'Otros', split_with: [] })
      fetchData()
    }
  }

  async function handleEditClick(exp) {
    // Obtener las reparticiones actuales para este gasto
    const { data: splits } = await supabase.from('expense_splits').select('friend_id').eq('expense_id', exp.id)
    const splitWithIds = splits?.map(s => s.friend_id) || []
    
    setEditingExpense(exp)
    setNewExpense({
      description: exp.description,
      amount: exp.amount.toString(),
      paid_by: exp.paid_by?.id || exp.paid_by,
      category: exp.category || 'Otros',
      split_with: splitWithIds
    })
    setShowAddExpense(true)
  }

  async function handleSettleDebt(fromName, toName, amount) {
    const fromFriend = friends.find(f => f.name === fromName)
    const toFriend = friends.find(f => f.name === toName)
    
    if (!fromFriend || !toFriend) return

    const { error } = await supabase.from('payments').insert([{
      group_id: currentGroupId,
      from_id: fromFriend.id,
      to_id: toFriend.id,
      amount: parseFloat(amount)
    }])

    if (error) {
      alert('Error registrando pago: ' + error.message)
    } else {
      fetchData()
    }
  }

  const [suggestedSettlements, setSuggestedSettlements] = useState([])

  function simplifyDebts(balances) {
    let debtors = balances.filter(b => b.amount < -0.01).map(b => ({ ...b, amount: Math.abs(b.amount) })).sort((a, b) => b.amount - a.amount);
    let creditors = balances.filter(b => b.amount > 0.01).map(b => ({ ...b })).sort((a, b) => b.amount - a.amount);
    
    const transactions = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(debtors[i].amount, creditors[j].amount);
      transactions.push({
        from: debtors[i].name,
        to: creditors[j].name,
        amount: amount
      });

      debtors[i].amount -= amount;
      creditors[j].amount -= amount;

      if (debtors[i].amount < 0.01) i++;
      if (creditors[j].amount < 0.01) j++;
    }
    return transactions;
  }

  const exportToCSV = () => {
    const headers = ['Fecha', 'Descripción', 'Categoría', 'Pagador', 'Monto'];
    const rows = expenses.map(exp => [
      new Date(exp.created_at).toLocaleDateString(),
      exp.description,
      exp.category || 'Otros',
      exp.paid_by?.name || '?',
      exp.amount
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `gastos_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function calculateBalances() {
    const { data: splitsData } = await supabase.from('expense_splits').select('*')
    
    const balances = {}
    friends.forEach(f => balances[f.id] = { name: f.name, amount: 0 })

    expenses.forEach(exp => {
      const payerId = exp.paid_by?.id || exp.paid_by
      if (balances[payerId]) {
        balances[payerId].amount += parseFloat(exp.amount)
      }
    })

    splitsData?.forEach(split => {
      if (balances[split.friend_id]) {
        balances[split.friend_id].amount -= parseFloat(split.amount)
      }
    })

    // Añadir lógica de pagos (liquidaciones)
    payments.forEach(pay => {
      const fromId = pay.from_id?.id || pay.from_id
      const toId = pay.to_id?.id || pay.to_id
      
      if (balances[fromId]) balances[fromId].amount += parseFloat(pay.amount)
      if (balances[toId]) balances[toId].amount -= parseFloat(pay.amount)
    })

    return Object.values(balances)
  }

  const [balanceList, setBalanceList] = useState([])

  useEffect(() => {
    if (!loading && friends.length > 0) {
      calculateBalances().then(list => {
        setBalanceList(list)
        setSuggestedSettlements(simplifyDebts(list))
      })
    } else {
      setBalanceList([])
      setSuggestedSettlements([])
    }
  }, [loading, friends, expenses])

  const categoryData = Object.keys(CATEGORIES).map(cat => ({
    name: cat,
    value: expenses.filter(e => e.category === cat).reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
  })).filter(d => d.value > 0);

  if (!session) {
    return <Auth />
  }

  const handleLogout = () => {
    supabase.auth.signOut()
    setCurrentGroupId(null)
    setGroups([])
  }

  return (
    <div className="App">
      <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{session.user.email}</span>
        <button 
          onClick={handleLogout}
          className="btn-secondary" 
          style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <LogOut size={14} /> Salir
        </button>
      </div>

      <header className="glass-card main-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="gradient-text" style={{ fontSize: '3rem' }}>Dividir Gastos</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>Viajes, cenas y compartidos</p>
          </div>
          <button className="btn-primary" onClick={() => setShowAddGroup(true)}>
            <Plus size={20} /> Nueva Sala
          </button>
        </div>

        <div className="group-selector">
          {groups.map(g => (
            <div 
              key={g.id} 
              className={`group-tab ${currentGroupId === g.id ? 'active' : ''}`}
              onClick={() => setCurrentGroupId(g.id)}
            >
              <Layout size={18} />
              <span>{g.name}</span>
              {currentGroupId === g.id && (
                <Trash2 
                  size={14} 
                  className="delete-group-icon" 
                  onClick={(e) => { e.stopPropagation(); deleteGroup(g.id); }} 
                />
              )}
            </div>
          ))}
        </div>
      </header>

      {currentGroupId ? (
        <>
          <div className="dashboard-grid">
            <div className="glass-card chart-container" style={{ minHeight: '350px' }}>
              <h3><PieChartIcon size={20} /> Gastos por Categoría</h3>
              <div style={{ width: '100%', height: '250px' }}>
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CATEGORIES[entry.name]?.color || '#8884d8'} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-muted)' }}>Añade gastos para ver estadísticas</p>
                )}
              </div>
            </div>

            <div className="glass-card chart-container" style={{ minHeight: '350px' }}>
              <h3><Calculator size={20} /> Balances Netos</h3>
              <div style={{ width: '100%', height: '250px' }}>
                {balanceList.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={balanceList}>
                      <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="amount" fill="#ffffff" radius={[4, 4, 0, 0]}>
                        {balanceList.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.amount >= 0 ? '#ffffff' : '#444444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-muted)' }}>No hay balances para mostrar</p>
                )}
              </div>
            </div>

            <div className="debt-summary">
              {balanceList.map(b => (
                <div key={b.name} className="glass-card debt-card animate-fade">
                  <Calculator size={24} color={b.amount >= 0 ? '#ffffff' : '#666666'} />
                  <h4 style={{ margin: '0.8rem 0', fontSize: '1.4rem' }}>{b.name}</h4>
                  <p className={b.amount >= 0 ? 'amount' : 'amount negative'}>
                    {b.amount >= 0 ? `Le deben: $${b.amount.toFixed(2)}` : `Debe: $${Math.abs(b.amount).toFixed(2)}`}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2><History size={20} /> Historial</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-secondary" onClick={exportToCSV} title="Exportar CSV">
                  <Download size={18} />
                </button>
                <button className="btn-primary" onClick={() => setShowAddExpense(true)}>
                  <Plus size={20} /> Nuevo Gasto
                </button>
              </div>
            </div>

            {loading ? (
              <p>Cargando...</p>
            ) : expenses.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay gastos registrados en esta sala</p>
            ) : (
              expenses.map(exp => (
                <div key={exp.id} className="expense-item animate-fade">
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '1rem' }}>
                    {CATEGORIES[exp.category]?.icon || <Tag size={16} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '1.2rem' }}>{exp.description}</strong>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Calendar size={12} /> {formatDate(exp.created_at)} • Pagado por: {exp.paid_by?.name || 'Desconocido'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="amount">${exp.amount}</div>
                    <button 
                      onClick={() => handleEditClick(exp)}
                      className="btn-icon"
                      title="Editar"
                    >
                      <Edit3 size={16} /> 
                    </button>
                    <button 
                      onClick={() => deleteExpense(exp.id)}
                      className="btn-icon"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}

            {payments.length > 0 && (
              <>
                <h3 style={{ marginTop: '2rem', marginBottom: '1rem', fontSize: '1rem', opacity: 0.7 }}>Pagos y Liquidaciones</h3>
                {payments.map(pay => (
                  <div key={pay.id} className="expense-item animate-fade" style={{ borderLeft: '4px solid #6BCB77', opacity: 0.8 }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(107, 203, 119, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '1rem' }}>
                      <Calculator size={16} color="#6BCB77" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <strong>Pago de deuda</strong>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {pay.from_id?.name} → {pay.to_id?.name} • {formatDate(pay.created_at)}
                      </p>
                    </div>
                    <div className="amount" style={{ color: '#6BCB77' }}>${pay.amount}</div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="glass-card">

            <h2><Calculator size={20} /> Liquidaciones Sugeridas</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Forma más eficiente de saldar todas las deudas</p>
            {suggestedSettlements.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#6BCB77', fontWeight: 'bold' }}>¡Todo saldado! 🎉</p>
            ) : (
              suggestedSettlements.map((s, i) => (
                <div key={i} className="expense-item animate-fade" style={{ borderLeft: '4px solid #4D96FF' }}>
                  <div style={{ flex: 1 }}>
                    <strong>{s.from}</strong> <span style={{ color: 'var(--text-muted)' }}>debe pagar a</span> <strong>{s.to}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="amount" style={{ color: '#4D96FF' }}>${s.amount.toFixed(2)}</div>
                    <button 
                      className="btn-primary" 
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                      onClick={() => handleSettleDebt(s.from, s.to, s.amount)}
                    >
                      Saldar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2><Users size={20} /> Amigos en esta sala</h2>
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
        </>
      ) : (
        <div className="glass-card" style={{ textAlign: 'center', padding: '5rem' }}>
          <Layout size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h2>No hay salas seleccionadas</h2>
          <p style={{ color: 'var(--text-muted)' }}>Crea una nueva sala arriba para empezar a dividir gastos</p>
        </div>
      )}

      {showAddExpense && (
        <div className="modal-overlay">
          <div className="glass-card" style={{ width: '90%', maxWidth: '400px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingExpense ? 'Editar Gasto' : 'Agregar Gasto'}</h2>
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
                <label>Categoría</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {Object.keys(CATEGORIES).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      className={`btn-secondary ${newExpense.category === cat ? 'active' : ''}`}
                      onClick={() => setNewExpense({...newExpense, category: cat})}
                      style={{ 
                        fontSize: '0.7rem', 
                        padding: '0.5rem', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        gap: '0.3rem',
                        borderColor: newExpense.category === cat ? CATEGORIES[cat].color : 'transparent',
                        background: newExpense.category === cat ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'
                      }}
                    >
                      {CATEGORIES[cat].icon}
                      {cat}
                    </button>
                  ))}
                </div>
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
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  {editingExpense ? 'Guardar Cambios' : 'Guardar'}
                </button>
                <button type="button" onClick={() => { setShowAddExpense(false); setEditingExpense(null); }} className="btn-secondary" style={{ flex: 1 }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddGroup && (
        <div className="modal-overlay">
          <div className="glass-card" style={{ width: '90%', maxWidth: '400px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Nueva Sala</h2>
            <form onSubmit={addGroup}>
              <div className="input-group">
                <label>Nombre de la sala/viaje</label>
                <input 
                  type="text" 
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Ej: Viaje a la Playa"
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Crear</button>
                <button type="button" onClick={() => setShowAddGroup(false)} className="btn-secondary" style={{ flex: 1 }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
