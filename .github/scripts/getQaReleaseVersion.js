module.exports = async ({github, context, PACKAGE_VERSION}) => {
    const {
      repo: {owner, repo},
    } = context
    const version = PACKAGE_VERSION
    let tags = await github.rest.repos.listTags({owner, repo})
    tags = (tags && tags.data) || []
    const re = new RegExp(`v${version}-qa\.`)
  
    const next_sub_version =
      tags.reduce((version, {name}) => {
        if (!re.test(name)) return version
        const sub_version = parseInt(name.replace(re, ''), 10)
        if (!sub_version) return version
        return Math.max(version, sub_version)
      }, 0) + 1
  
    return {
      version: `${version}-qa.${next_sub_version}`,
      tag: `v${version}-qa.${next_sub_version}`,
      prod_version: `${version}`,
      prod_tag: `v${version}`,
    }
  }
  