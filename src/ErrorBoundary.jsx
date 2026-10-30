import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="empty-state" role="alert">
        <h2>Quill couldn’t open this tool</h2>
        <p>Please reload and try again. Your original files are unchanged.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload Quill</button>
        {this.props.onReset && <button className="btn" onClick={this.props.onReset}>Back to all tools</button>}
      </section>
    );
  }
}
