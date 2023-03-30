// import {Platform} from 'react-native';
import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import schema from './model/schema';
import migrations from './model/migrations';
import {Post, Comment} from './model/post';

console.log('Post', Post);
console.log('Comment', Comment);

const adapter = new SQLiteAdapter({
  dbName: 'myapp1',
  schema,
  migrations,
  // RN not support synchronous mode yet(ps: jsi === true means enable synchronous mode).see below:
  // https://github.com/facebook/react-native/issues/26705
  // https://github.com/Nozbe/WatermelonDB/issues/813
  // This bug may only appear in debug mode.We will continue to watch...
  jsi: false, // jsi: Platform.OS === 'ios',
  onSetUpError: error => {},
});

const database = new Database({
  adapter,
  modelClasses: [Post, Comment],
});

// database
//   .write(async () => {
//     // database.batch
//     // table.prepareCreate
//     // record.prepareUpdate ...
//     let _p;
//     const post = await database.get('posts').create(p => {
//       p.title = '帖子';
//       p.body = '我是一个帖子';
//       _p = p;
//     });
//     const comment = await database.get('comments').create(c => {
//       c.post.set(post);
//       _p.comment.set(c.id);
//       c.body = '我是一条评论';
//     });
//     console.log('comment', comment);
//     return post;
//   })
//   .then(res => {
//     console.log('res', res);
//   })
//   .catch(err => {
//     console.log('err', err);
//   });

// const query = table.query();

// console.log('table', table);
// console.log('query', query);
// query
//   .fetch()
//   .then(res => {
//     console.log('res', res);
//   })
//   .catch(console.log);

export default database;
