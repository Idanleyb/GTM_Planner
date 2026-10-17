import { createContext, useContext } from 'react'

/** True for workspace viewers: controls render disabled and row actions are hidden. */
export const ReadOnlyContext = createContext(false)
export const useReadOnly = () => useContext(ReadOnlyContext)
