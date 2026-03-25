import React from 'react'

const BG = '#0a0a0a'
const ACCENT = '#D97706'
const FONT = "'Courier New', Courier, monospace"

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          fontFamily: FONT, background: BG, color: '#e5e5e5', minHeight: '100%',
          padding: 24, maxWidth: 560, margin: '0 auto', lineHeight: 1.5
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, color: ACCENT }}>SOMETHING BROKE</div>
          <p style={{ marginTop: 12, fontSize: 12 }}>Reload the app. If it keeps happening, check the console.</p>
          {this.state.error?.message && (
            <pre style={{ marginTop: 16, fontSize: 11, color: '#888', whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
