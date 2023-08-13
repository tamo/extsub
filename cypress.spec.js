describe('test extsub', () => {
  it('visit the page', () => {
    cy.visit('https://tamo.github.io/extsub/')
  })
  it('checks everything is loaded', () => {
    cy.on('uncaught:exception', (err, runnable, promise) => {
      expect(err.message).to.contain('SharedArrayBuffer')
      done()
      return false
    })
    cy.get('#logs[data-loaded="true"]', { timeout: 20000 })
  })
  it('upload mp4', () => {
    cy.get('input#uploader').selectFile('test.mp4')
  })
  it('result', () => {
    cy.get('#subtext', { timeout: 10000 })
      .should('contain', 'タイトル ()')
      .and('contain', 'この動画は')
      .and('contain', 'extsubの')
      .and('contain', 'テストです')
  })
})