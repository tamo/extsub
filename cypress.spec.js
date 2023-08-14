describe('test extsub', () => {
  it('visits the site', (done) => {
    cy.on('uncaught:exception', (err, runnable) => {
      expect(err.message).to.contain('SharedArrayBuffer')
      done()
      return false
    })
    cy.visit('https://tamo.github.io/extsub/')
    cy.wait(10000)
  })
  it('reloads the page', (done) => {
    cy.on('uncaught:exception', (err, runnable) => {
      expect(err.message).to.contain('SharedArrayBuffer')
      done()
      return false
    })
    cy.get('#refresh', { timeout: 10000 }).click()
    cy.wait(10000)
  })
  it('reloads the page again', (done) => {
    cy.on('uncaught:exception', (err, runnable) => {
      expect(err.message).to.contain('SharedArrayBuffer')
      done()
      return false
    })
    cy.get('#refresh', { timeout: 10000 }).click()
    cy.wait(10000)
  })
  it('checks everything is loaded', () => {
    cy.get('#logs[data-loaded="true"]', { timeout: 20000 })
  })
  it('uploads a file', () => {
    cy.get('input#uploader', { timeout: 20000 }).selectFile('test.mp4')
    cy.get('#subtext', { timeout: 10000 })
      .should('contain', 'タイトル ()')
      .and('contain', 'この動画は')
      .and('contain', 'extsubの')
      .and('contain', 'テストです')
  })
})