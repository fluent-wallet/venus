import {appSchema, tableSchema} from '@nozbe/watermelondb';

const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'posts',
      columns: [
        {name: 'title', type: 'string'},
        {name: 'subtitle', type: 'string', isOptional: true},
        {name: 'body', type: 'string'},
        {name: 'is_pinned', type: 'boolean'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'comments',
      columns: [
        {name: 'body', type: 'string'},
        {name: 'post_id', type: 'string', isIndexed: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
  ],
});

// WatermelonDB can not define a unique column.
// We will should do some prevent duplicates manually.
// see: https://github.com/Nozbe/WatermelonDB/issues/198. https://github.com/Nozbe/WatermelonDB/issues/36
// isIndexed: true. Indexing makes querying by a column faster.Should add later

const DBTABLESCHEMAS = [
  {
    name: 'hd_path',
    columns: [
      {name: 'name', type: 'string'},
      {name: 'value', type: 'string'},
    ],
  },
  {
    name: 'network',
    columns: [
      {name: 'name', type: 'string'},
      {name: 'icon', type: 'string', isOptional: true},
      {name: 'endpoint', type: 'string'},
      {name: 'hd_path_id', type: 'string'},
      {name: 'netId', type: 'number'},
      // @json
      {name: 'ticker', type: 'string', isOptional: true},
      {name: 'builtin', type: 'string'},
      {name: 'scanUrl', type: 'string', isOptional: true},
      {name: 'selected', type: 'boolean', isOptional: true},
      {name: 'cacheTime', type: 'number', isOptional: true},
    ],
  },
];
const schema2 = appSchema({
  version: 1,
  tables: DBTABLESCHEMAS.map(item => tableSchema(item)),
});

export default schema;
