module.exports = async ({github, context, PACKAGE_VERSION}) => {
    const {
      repo: {owner, repo},
    } = context
    const nextver = PACKAGE_VERSION
    let tags = await github.rest.repos.listTags({owner, repo})
    tags = (tags && tags.data) || []
    const re = new RegExp(`v${nextver}-rc\.`)
  
    const nextrc =
      tags.reduce((nextrc, {name}) => {
        if (!re.test(name)) return nextrc
        const rc = parseInt(name.replace(re, ''), 10)
        if (!rc) return nextrc
        return Math.max(nextrc, rc)
      }, 0) + 1
  
    return {
      version: `${nextver}-qa.${nextrc}`,
      tag: `v${nextver}-qa.${nextrc}`,
      prod_version: `${nextver}`,
      prod_tag: `v${nextver}`,
    }
  }
  