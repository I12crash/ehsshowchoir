import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { User, LogOut, Menu, X } from 'lucide-react'

interface HeaderProps {
  user: any
  signOut: () => void
}

const Header: React.FC<HeaderProps> = ({ user, signOut }) => {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const isActive = (path: string) => location.pathname === path

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/invoices', label: 'Invoices', icon: '📄' },
    { path: '/students', label: 'Students', icon: '👥' },
    { path: '/payments', label: 'Payments', icon: '💳' },
    { path: '/settings', label: 'Settings', icon: '⚙️' }
  ]

  return (
    <header className="header">
      <div className="hero-section">
        <div className="container">
          <h1 className="heading-primary">Edgewood Show Choir</h1>
          <p className="subtitle">Payment Portal</p>
        </div>
      </div>
      
      <nav className="navigation">
        <div className="container">
          <div className="nav-content">
            <div className="nav-brand">
              <span className="nav-logo">🎵</span>
            </div>

            {/* Mobile menu button */}
            <button 
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            
            {/* Navigation links */}
            <div className={`nav-links ${mobileMenuOpen ? 'nav-links-open' : ''}`}>
              {navItems.map((item) => (
                <Link 
                  key={item.path}
                  to={item.path} 
                  className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
            
            {/* User section */}
            <div className="user-section">
              <div className="user-info">
                <User size={20} />
                <span className="user-name">
                  {user?.signInDetails?.loginId || user?.username || 'User'}
                </span>
              </div>
              <button 
                onClick={signOut} 
                className="btn btn-secondary btn-small"
                title="Sign Out"
              >
                <LogOut size={16} />
                <span className="btn-text">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}

export default Header
