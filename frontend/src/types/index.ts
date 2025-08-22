export interface Student {
  id: string
  firstName: string
  lastName: string
  email: string
  grade: string
  parentEmail: string
  parentName: string
  balance: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  studentId: string
  amount: number
  description: string
  date: string
  method: string
  status: string
  transactionId?: string
}

export interface InvoiceData {
  id: string
  studentId: string
  amount: number
  description: string
  dueDate: string
  status: string
  createdAt: string
  pdfUrl?: string
}

export interface BulkInvoiceResult {
  results: {
    successful: number
    failed: number
    errors?: string[]
  }
}

export interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
}
