import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { LogIn, UserPlus, Mail, Lock, Loader2 } from 'lucide-react'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState({ type: '', text: '' })

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        setMessage({ type: 'success', text: '¡Cuenta creada! Revisa tu email para confirmar.' })
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container animate-fade">
      <div className="glass-card login-card">
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="gradient-text" style={{ fontSize: '2.5rem' }}>
            {isSignUp ? 'Crear Cuenta' : 'Bienvenido'}
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {isSignUp ? 'Únete para gestionar tus gastos' : 'Inicia sesión para continuar'}
          </p>
        </header>

        {message.text && (
          <div className={`auth-message ${message.type}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleAuth}>
          <div className="input-group">
            <label><Mail size={14} /> Email</label>
            <input 
              type="email" 
              placeholder="tu@email.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label><Lock size={14} /> Contraseña</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', marginTop: '1rem', padding: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isSignUp ? <UserPlus size={20} /> : <LogIn size={20} />)}
            {loading ? 'Procesando...' : (isSignUp ? 'Registrarse' : 'Entrar')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          {isSignUp ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'} {' '}
          <span 
            className="auth-toggle"
            onClick={() => { setIsSignUp(!isSignUp); setMessage({ type: '', text: '' }); }}
          >
            {isSignUp ? 'Inicia sesión' : 'Regístrate aquí'}
          </span>
        </p>
      </div>
    </div>
  )
}
