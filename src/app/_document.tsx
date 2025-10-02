
import { Html, Head, Main, NextScript } from 'next/document'
import type { DocumentProps } from 'next/document'
import React from 'react';
 
class MyDocument extends React.Component<DocumentProps & { nonce: string }> {
  render() {
    const { nonce } = this.props
    return (
      <Html>
        <Head nonce={nonce} />
        <body>
          <Main />
          <NextScript nonce={nonce} />
        </body>
      </Html>
    )
  }
}
 
export default MyDocument
