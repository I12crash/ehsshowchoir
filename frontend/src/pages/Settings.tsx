import React, { useState } from 'react'
import { 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Shield, 
  Database,
  Mail,
  Palette,
  Download,
  Upload,
  Save,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('profile')
  const [settings, setSettings] = useState({
    profile: {
      name: 'Edgewood Show Choir Treasurer',
      email: 'treasurer@edgewoodshowchoirpayments.org',
      phone: '',
      organization: 'Edgewood High School Show Choir'
    },
    notifications: {
      emailNotifications: true,
      paymentAlerts: true,
      weeklyReports: false,
      systemUpdates: true
    },
    display: {
      theme: 'light',
      currency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      timeZone: 'America/New_York'
    },
    security: {
      twoFactorEnabled: false,
      sessionTimeout: 30,
      passwordLastChanged: '2024-01-15'
    }
  })

  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const handleSave = async (section: string) => {
    setIsSaving(true)
    setSaveMessage('')
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSaveMessage(`${section} settings saved successfully!`)
      
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      setSaveMessage('Error saving settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const updateSetting = (section: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [key]: value
      }
    }))
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'display', label: 'Display', icon: Palette },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'data', label: 'Data', icon: Database }
  ]

  return (
    <div className="settings">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">
            <SettingsIcon size={32} />
            Settings
          </h1>
          <p className="page-subtitle">Manage your account and system preferences</p>
        </div>

        <div className="settings-container">
          {/* Settings Navigation */}
          <div className="settings-nav">
            {tabs.map(tab => {
              const IconComponent = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                >
                  <IconComponent size={20} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Settings Content */}
          <div className="settings-content">
            {saveMessage && (
              <div className={`alert ${saveMessage.includes('Error') ? 'alert-error' : 'alert-success'}`}>
                {saveMessage.includes('Error') ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                {saveMessage}
              </div>
            )}

            {/* Profile Settings */}
            {activeTab === 'profile' && (
              <div className="settings-section">
                <h2 className="section-title">Profile Information</h2>
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={settings.profile.name}
                    onChange={(e) => updateSetting('profile', 'name', e.target.value)}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={settings.profile.email}
                    onChange={(e) => updateSetting('profile', 'email', e.target.value)}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={settings.profile.phone}
                    onChange={(e) => updateSetting('profile', 'phone', e.target.value)}
                    className="form-control"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="form-group">
                  <label>Organization</label>
                  <input
                    type="text"
                    value={settings.profile.organization}
                    onChange={(e) => updateSetting('profile', 'organization', e.target.value)}
                    className="form-control"
                  />
                </div>
                <button 
                  onClick={() => handleSave('Profile')}
                  disabled={isSaving}
                  className="btn btn-primary"
                >
                  <Save size={16} />
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            )}

            {/* Notification Settings */}
            {activeTab === 'notifications' && (
              <div className="settings-section">
                <h2 className="section-title">Notification Preferences</h2>
                <div className="settings-group">
                  <div className="setting-item">
                    <div className="setting-info">
                      <h3>Email Notifications</h3>
                      <p>Receive notifications via email</p>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.notifications.emailNotifications}
                        onChange={(e) => updateSetting('notifications', 'emailNotifications', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  
                  <div className="setting-item">
                    <div className="setting-info">
                      <h3>Payment Alerts</h3>
                      <p>Get notified when payments are received</p>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.notifications.paymentAlerts}
                        onChange={(e) => updateSetting('notifications', 'paymentAlerts', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  
                  <div className="setting-item">
                    <div className="setting-info">
                      <h3>Weekly Reports</h3>
                      <p>Receive weekly summary reports</p>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.notifications.weeklyReports}
                        onChange={(e) => updateSetting('notifications', 'weeklyReports', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  
                  <div className="setting-item">
                    <div className="setting-info">
                      <h3>System Updates</h3>
                      <p>Notifications about system maintenance and updates</p>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.notifications.systemUpdates}
                        onChange={(e) => updateSetting('notifications', 'systemUpdates', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
                
                <button 
                  onClick={() => handleSave('Notification')}
                  disabled={isSaving}
                  className="btn btn-primary"
                >
                  <Save size={16} />
                  {isSaving ? 'Saving...' : 'Save Notifications'}
                </button>
              </div>
            )}

            {/* Display Settings */}
            {activeTab === 'display' && (
              <div className="settings-section">
                <h2 className="section-title">Display Preferences</h2>
                <div className="form-group">
                  <label>Theme</label>
                  <select
                    value={settings.display.theme}
                    onChange={(e) => updateSetting('display', 'theme', e.target.value)}
                    className="form-control"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Currency</label>
                  <select
                    value={settings.display.currency}
                    onChange={(e) => updateSetting('display', 'currency', e.target.value)}
                    className="form-control"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Date Format</label>
                  <select
                    value={settings.display.dateFormat}
                    onChange={(e) => updateSetting('display', 'dateFormat', e.target.value)}
                    className="form-control"
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Time Zone</label>
                  <select
                    value={settings.display.timeZone}
                    onChange={(e) => updateSetting('display', 'timeZone', e.target.value)}
                    className="form-control"
                  >
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                  </select>
                </div>
                <button 
                  onClick={() => handleSave('Display')}
                  disabled={isSaving}
                  className="btn btn-primary"
                >
                  <Save size={16} />
                  {isSaving ? 'Saving...' : 'Save Display'}
                </button>
              </div>
            )}

            {/* Security Settings */}
            {activeTab === 'security' && (
              <div className="settings-section">
                <h2 className="section-title">Security Settings</h2>
                <div className="settings-group">
                  <div className="setting-item">
                    <div className="setting-info">
                      <h3>Two-Factor Authentication</h3>
                      <p>Add an extra layer of security to your account</p>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.security.twoFactorEnabled}
                        onChange={(e) => updateSetting('security', 'twoFactorEnabled', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Session Timeout (minutes)</label>
                  <select
                    value={settings.security.sessionTimeout}
                    onChange={(e) => updateSetting('security', 'sessionTimeout', parseInt(e.target.value))}
                    className="form-control"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
                
                <div className="security-info">
                  <p><strong>Password last changed:</strong> {settings.security.passwordLastChanged}</p>
                  <button className="btn btn-outline">Change Password</button>
                </div>
                
                <button 
                  onClick={() => handleSave('Security')}
                  disabled={isSaving}
                  className="btn btn-primary"
                >
                  <Save size={16} />
                  {isSaving ? 'Saving...' : 'Save Security'}
                </button>
              </div>
            )}

            {/* Data Management */}
            {activeTab === 'data' && (
              <div className="settings-section">
                <h2 className="section-title">Data Management</h2>
                
                <div className="data-actions">
                  <div className="data-action-card">
                    <div className="data-action-info">
                      <h3>
                        <Download size={20} />
                        Export Data
                      </h3>
                      <p>Download all your student and payment data</p>
                    </div>
                    <button className="btn btn-secondary">
                      <Download size={16} />
                      Export
                    </button>
                  </div>
                  
                  <div className="data-action-card">
                    <div className="data-action-info">
                      <h3>
                        <Upload size={20} />
                        Import Data
                      </h3>
                      <p>Upload student or payment data from CSV</p>
                    </div>
                    <button className="btn btn-secondary">
                      <Upload size={16} />
                      Import
                    </button>
                  </div>
                  
                  <div className="data-action-card">
                    <div className="data-action-info">
                      <h3>
                        <Mail size={20} />
                        Email Settings
                      </h3>
                      <p>Configure email templates and sender information</p>
                    </div>
                    <button className="btn btn-secondary">
                      Configure
                    </button>
                  </div>
                </div>
                
                <div className="danger-zone">
                  <h3>Danger Zone</h3>
                  <p>These actions cannot be undone. Please be careful.</p>
                  <button className="btn btn-danger">
                    Clear All Data
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
