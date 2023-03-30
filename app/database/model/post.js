import {Model} from '@nozbe/watermelondb';
import {
  field,
  text,
  children,
  writer,
  relation,
  readonly,
  date,
} from '@nozbe/watermelondb/decorators';

class Post extends Model {
  static table = 'posts';

  // static associations = {
  //   comments: {type: 'has_many', foreignKey: 'post_id'},
  // };

  @text('title') title;

  @text('body') body;

  @field('is_pinned') isPinned;

  @readonly @date('created_at') createdAt;

  @readonly @date('updated_at') updatedAt;

  @relation('comments', 'comment_id') comments;

  @writer async changePostTitle() {
    this.update(post => {
      post.title = new Date().getTime().toString();
    });
  }
}

class Comment extends Model {
  static table = 'comments';

  // static associations = {posts: {type: 'belongs_to', key: 'post_id'}};

  @text('body') body;

  @relation('posts', 'post_id') post;

  @readonly @date('created_at') createdAt;

  @readonly @date('updated_at') updatedAt;
}

export {Post, Comment};
