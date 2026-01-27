import React, { createContext, useContext, useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './AuthContext'

const CompanyContext = createContext()

export function useCompany() {
  return useContext(CompanyContext)
}

export function CompanyProvider({ children }) {
  const { userData } = useAuth()
  const [companyData, setCompanyData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadCompanyData = async () => {
      if (!userData?.companyId) {
        setCompanyData(null)
        setLoading(false)
        return
      }

      try {
        const companyRef = doc(db, 'companies', userData.companyId)
        const companyDoc = await getDoc(companyRef)
        
        if (companyDoc.exists()) {
          setCompanyData(companyDoc.data())
        }
      } catch (error) {
        console.error('Error loading company data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCompanyData()
  }, [userData])

  const value = {
    companyData,
    loading
  }

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  )
}
