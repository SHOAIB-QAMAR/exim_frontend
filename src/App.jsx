import { ThemeProvider } from './context/ThemeContext'
import { UIProvider } from './context/UIContext'

import Layout from './layouts/Layout'

function App() {
  return (
    <ThemeProvider>
      <UIProvider>
        <Layout />
      </UIProvider>
    </ThemeProvider>
  )
}

export default App