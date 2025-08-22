import React from 'react'
import { ExternalLink, Mail, Globe } from 'lucide-react'

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h4>Edgewood Show Choir</h4>
            <p>Supporting excellence in vocal performance and music education at Edgewood High School.</p>
            <div className="footer-social">
              <a 
                href="https://www.edgewoodchoirs.org" 
                target="_blank" 
                rel="noopener noreferrer"
                className="social-link"
                title="Visit Main Website"
              >
                <Globe size={18} />
                Main Website
              </a>
            </div>
          </div>
          
          <div className="footer-section">
            <h4>Contact Information</h4>
            <div className="contact-info">
              <div className="contact-item">
                <Mail size={16} />
                <span>treasurer@edgewoodshowchoirpayments.org</span>
              </div>
            </div>
            
            <h4 className="mt-4">Quick Links</h4>
            <ul className="footer-links">
              <li><a href="/invoices">Invoice Management</a></li>
              <li><a href="/students">Student Management</a></li>
              <li><a href="/payments">Payment History</a></li>
              <li><a href="/settings">Account Settings</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4>Support</h4>
            <p>Need help with payments or have questions about your account?</p>
            <a 
              href="mailto:treasurer@edgewoodshowchoirpayments.org" 
              className="btn btn-outline btn-small"
            >
              <Mail size={16} />
              Contact Support
            </a>
            
            <div className="footer-info mt-4">
              <p><strong>System Status:</strong> <span className="status-indicator online">Online</span></p>
              <p className="text-small">Last updated: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="footer-legal">
            <p>&copy; {currentYear} Edgewood Show Choir. All rights reserved.</p>
            <p className="text-small">
              Powered by AWS | 
              <a href="https://aws.amazon.com/privacy/" target="_blank" rel="noopener noreferrer" className="footer-link">
                Privacy Policy <ExternalLink size={12} />
              </a>
            </p>
          </div>
          
          <div className="footer-version">
            <p className="text-small">Version 1.0.0</p>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
