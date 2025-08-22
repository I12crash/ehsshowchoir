
import { Link, useLocation } from 'react-router-dom'
import { 
  HomeIcon, 
  UserGroupIcon, 
  CreditCardIcon, 
  DocumentTextIcon 
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Students', href: '/students', icon: UserGroupIcon },
  { name: 'Payments', href: '/payments', icon: CreditCardIcon },
  { name: 'Invoices', href: '/invoices', icon: DocumentTextIcon },
]

export default function Navigation() {
  const location = useLocation()

  return (
    <nav className="w-64 bg-white shadow-lg">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900">
          EHS Show Choir
        </h2>
      </div>
      <div className="mt-6">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`${
                isActive
                  ? 'bg-blue-50 border-r-4 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } group flex items-center px-6 py-3 text-sm font-medium`}
            >
              <item.icon
                className={`${
                  isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                } mr-3 h-6 w-6`}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
