export const dbModelContent = `import cassandra from 'cassandra-driver';

export const dbClient = new cassandra.Client({
  contactPoints: process.env.DB_CONTACT_POINTS?.split(','),
  keyspace: process.env.DB_DEFAULT_KEYSPACE,
  localDataCenter: process.env.DB_LOCAL_DATA_CENTER,
  credentials: {
    username: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
  },
  protocolOptions: {
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  },
});
`;

export const typeContent = `/**
 * Helper type: shifts a tuple by removing the first element.
 *
 * @example
 *   type Original = [1, 2, 3];
 *   type Result = Shift<Original>; // [2, 3]
 *
 * @template T - Tuple type to shift
 */
type Shift<T extends readonly unknown[]> = T extends [unknown, ...infer R]
  ? R
  : [];

/**
 * Core recursive type that enforces progressive ordering of keys. Each later
 * key can only exist if all previous keys in the list exist.
 *
 * @example
 *   type Ordered = StrictOrder<[['a', string], ['b', number]]>;
 *   // Valid: { a: string } | { a: string; b: number } | {}
 *   // Invalid: { b: number } (cannot appear without \`a\`)
 *
 * @template T - Tuple of \`[key, type]\` pairs in the desired order
 * @template Acc - Accumulated object type (used internally for recursion)
 */
type StrictOrder<
  T extends readonly [string, unknown][],
  Acc extends object = object,
> = T extends []
  ? Acc
  :
      | (Acc & { [K in T[number] as K[0]]?: never })
      | StrictOrder<Shift<T>, Acc & { [K in T[0][0]]: T[0][1] }>;

/**
 * Enforces a strict progressive order of keys from a normal object type. Each
 * key can only appear if all previous keys in the provided order exist.
 *
 * @example
 *   type SecondClass = {
 *     status: string;
 *     payment: string;
 *     createdAt: Date;
 *   };
 *
 *   type OrderedSecondClass = ClusteringOrder<
 *     SecondClass,
 *     ['status', 'payment', 'createdAt']
 *   >;
 *
 *   // Valid:
 *   const valid1: OrderedSecondClass = {};
 *   const valid2: OrderedSecondClass = { status: 'active' };
 *   const valid3: OrderedSecondClass = { status: 'active', payment: 'paid' };
 *   const valid4: OrderedSecondClass = {
 *     status: 'active',
 *     payment: 'paid',
 *     createdAt: new Date(),
 *   };
 *
 *   // Invalid:
 *   const invalid1: OrderedSecondClass = { payment: 'paid' }; // status missing
 *   const invalid2: OrderedSecondClass = { createdAt: new Date() }; // status & payment missing
 *
 * @template Obj - Object type whose keys and types you want to enforce ordering
 *   on
 * @template Keys - Array of keys from \`Obj\` in the strict order they must
 *   appear
 */
export type ClusteringOrder<
  Obj extends Record<string, unknown>,
  Keys extends readonly (keyof Obj)[],
> = StrictOrder<{ [I in keyof Keys]: [Keys[I] & string, Obj[Keys[I]]] }>;

//MAPPER TYPES

import cassandra from 'cassandra-driver';

/**
 * - Takes in Model, PartitionKeys and Clustering keys and gives you a type where
 *   all partition and clustering keys are required. But other fields are
 *   optional.
 */
type CompleteDoc<Model, PartitionKeys, ClusteringKeys> = {
  [K in keyof PartitionKeys]: PartitionKeys[K];
} & { [K in keyof ClusteringKeys]: ClusteringKeys[K] } & Partial<
    Omit<Model, keyof PartitionKeys | keyof ClusteringKeys>
  >;

/**
 * The driver provides an object mapper that lets you interact with your data
 * like you would interact with a set of documents.
 *
 * @link - https://docs.datastax.com/en/developer/nodejs-driver/4.8/features/mapper/index.html
 */
export interface ModelMapper<
  Model extends object,
  PartitionKeys extends object,
  ClusteringKeys extends object = object,
  OrderedClusteringKeys extends object = object,
> extends cassandra.mapping.ModelMapper {
  /**
   * Gets one document matching the provided filter or \`null\` when not found.
   *
   * @note - All partition and clustering keys must be defined in order to
   * use this method.
   *
   * @link - https://docs.datastax.com/en/developer/nodejs-driver/4.8/features/mapper/queries/index.html#usage-examples
   */
  get<K extends keyof Model>(
    /** Partition keys and clustering keys (all of them) */
    doc: PartitionKeys & ClusteringKeys,
    /** Data retrieval options */
    docInfo: {
      /** Pick the fields you want it the result */
      fields: K[];
    },
    /**
     * Execution option is a string representing the Execution Profile.
     * Execution profiles allows you to define the execution options once and
     * reuse them across different execution invocations.
     *
     * If you use a string, make sure you have defined the profiles when
     * creating the Client instance or you can define a new one here.
     *
     * @link - https://docs.datastax.com/en/developer/nodejs-driver/4.8/features/mapper/queries/index.html#execution-options
     */
    executionOptions?: string | cassandra.mapping.MappingExecutionOptions,
  ): Promise<Pick<Model, K> | null>;
  // overload with no docInfo defined which means you get all the fields in the return value
  get(
    /** All Partition and Clustering keys */
    doc: PartitionKeys & ClusteringKeys,
    /**
     * If you not do not provide fields option here, you will get all the fields
     * from your table
     */
    docInfo?: undefined,
    /**
     * Execution option is a string representing the Execution Profile.
     * Execution profiles allows you to define the execution options once and
     * reuse them across different execution invocations.
     *
     * If you use a string, make sure you have defined the profiles when
     * creating the Client instance or you can define a new one here.
     *
     * @link - https://docs.datastax.com/en/developer/nodejs-driver/4.8/features/mapper/queries/index.html#execution-options
     */
    executionOptions?: string | cassandra.mapping.MappingExecutionOptions,
  ): Promise<Model | null>;

  /**
   * Filters by one or more primary keys and returns the \`Result<Model>\` that is
   * an iterable of objects. All Partition keys have to be specified and
   * Clustering keys are optional.
   *
   * @note - If you provide Clustering keys, make sure you have provided the correct order as
   * you have defined on your database table
   */
  find(
    /**
     * - Partition and OrderedClusteringKeys.
     *
     * @note - If you provide Clustering keys, make sure you have provided the correct order as
     * you have defined on your database table
     */
    doc: PartitionKeys & OrderedClusteringKeys,
    /** Retrieval option */
    docInfo?: FindDocInfoNoField<keyof ClusteringKeys>,
    /**
     * Execution option is a string representing the Execution Profile.
     * Execution profiles allows you to define the execution options once and
     * reuse them across different execution invocations.
     *
     * If you use a string, make sure you have defined the profiles when
     * creating the Client instance or you can define a new one here.
     *
     * @link - https://docs.datastax.com/en/developer/nodejs-driver/4.8/features/mapper/queries/index.html#execution-options
     */
    executionOptions?: string | cassandra.mapping.MappingExecutionOptions,
  ): Promise<cassandra.mapping.Result<Model>>;
  find<K extends keyof Model>(
    /**
     * - Partition and OrderedClusteringKeys.
     *
     * @note - If you provide Clustering keys, make sure you have provided the correct order as
     * you have defined on your database table
     */
    doc: PartitionKeys & OrderedClusteringKeys,
    /** Results option, like fields you want to get, limit and orderBy */
    docInfo?: FindDocInfo<K, keyof ClusteringKeys>,
    /**
     * Execution option is a string representing the Execution Profile.
     * Execution profiles allows you to define the execution options once and
     * reuse them across different execution invocations.
     *
     * If you use a string, make sure you have defined the profiles when
     * creating the Client instance or you can define a new one here.
     *
     * @link - https://docs.datastax.com/en/developer/nodejs-driver/4.8/features/mapper/queries/index.html#execution-options
     */
    executionOptions?: string | cassandra.mapping.MappingExecutionOptions,
  ): Promise<cassandra.mapping.Result<Pick<Model, K>>>;

  /** Get every data from the database without any filtering and searching */
  findAll(
    /** Results option, like fields you want to get, limit and orderBy */
    docInfo?: FindDocInfoNoField<keyof ClusteringKeys>,
    /**
     * Execution option is a string representing the Execution Profile.
     * Execution profiles allows you to define the execution options once and
     * reuse them across different execution invocations.
     *
     * If you use a string, make sure you have defined the profiles when
     * creating the Client instance or you can define a new one here.
     *
     * @link - https://docs.datastax.com/en/developer/nodejs-driver/4.8/features/mapper/queries/index.html#execution-options
     */
    executionOptions?: string | cassandra.mapping.MappingExecutionOptions,
  ): Promise<cassandra.mapping.Result<Model>>;
  findAll<K extends keyof Model>(
    /** Results option, like fields you want to get, limit and orderBy */
    docInfo?: FindDocInfo<K, keyof ClusteringKeys>,
    /**
     * Execution option is a string representing the Execution Profile.
     * Execution profiles allows you to define the execution options once and
     * reuse them across different execution invocations.
     *
     * If you use a string, make sure you have defined the profiles when
     * creating the Client instance or you can define a new one here.
     *
     * @link - https://docs.datastax.com/en/developer/nodejs-driver/4.8/features/mapper/queries/index.html#execution-options
     */
    executionOptions?: string | cassandra.mapping.MappingExecutionOptions,
  ): Promise<cassandra.mapping.Result<Pick<Model, K>>>;
  /**
   * Insert new records to your database
   *
   * @link - https://docs.datastax.com/en/developer/nodejs-driver/4.8/features/mapper/queries/index.html#insert
   */
  insert<K extends keyof Model>(
    /**
     * - Values you want to insert into db.
     *
     * @note - Partition keys and clustering keys are required for consistent database records, but technically, the database
     * will accept whatever you pass.
     */
    doc: PartitionKeys &
      ClusteringKeys &
      Partial<Omit<Model, keyof PartitionKeys | keyof ClusteringKeys>>,
    docInfo?: InsertDocInfo<K>,
    /**
     * Execution option is a string representing the Execution Profile.
     * Execution profiles allows you to define the execution options once and
     * reuse them across different execution invocations.
     *
     * If you use a string, make sure you have defined the profiles when
     * creating the Client instance or you can define a new one here.
     *
     * @link - https://docs.datastax.com/en/developer/nodejs-driver/4.8/features/mapper/queries/index.html#execution-options
     */
    executionOptions?: string | cassandra.mapping.MappingExecutionOptions,
  ): Promise<cassandra.mapping.Result<Model>>;
  /**
   * Update records
   *
   * @link - https://docs.datastax.com/en/developer/nodejs-driver/4.8/features/mapper/queries/index.html#update
   */
  update<K extends keyof Model>(
    /**
     * All PrimaryKeys and any of the other fields. On update if you do not
     * provide these keys instead of updating, the database will make it upsert,
     * creating new field with null fields.
     */
    doc: CompleteDoc<Model, PartitionKeys, ClusteringKeys>,
    /** Update options */
    docInfo?: UpdateDocInfo<K, keyof ClusteringKeys>,
    /**
     * Execution option is a string representing the Execution Profile.
     * Execution profiles allows you to define the execution options once and
     * reuse them across different execution invocations.
     *
     * If you use a string, make sure you have defined the profiles when
     * creating the Client instance or you can define a new one here.
     *
     * @link - https://docs.datastax.com/en/developer/nodejs-driver/4.8/features/mapper/queries/index.html#execution-options
     */
    executionOptions?: string | cassandra.mapping.MappingExecutionOptions,
  ): Promise<cassandra.mapping.Result<Model>>;

  /**
   * Remove record
   *
   * @link - https://docs.datastax.com/en/developer/nodejs-driver/4.8/features/mapper/queries/index.html#delete
   */
  remove<K extends keyof Model>(
    /**
     * The records you want to remove.
     *
     * @note - Note that if you provide only partition keys and there are multiple items in that partition key,
     * \`all of them will be removed\`. To make sure you delete only 1 record, provide the exact partition
     * and clustering keys (if any). Be cautious about this.
     */
    doc: CompleteDoc<Model, PartitionKeys, ClusteringKeys>,
    docInfo?: RemoveDocInfo<K>,
    /**
     * Execution option is a string representing the Execution Profile.
     * Execution profiles allows you to define the execution options once and
     * reuse them across different execution invocations.
     *
     * If you use a string, make sure you have defined the profiles when
     * creating the Client instance or you can define a new one here.
     *
     * @link - https://docs.datastax.com/en/developer/nodejs-driver/4.8/features/mapper/queries/index.html#execution-options
     */
    executionOptions?: string | cassandra.mapping.MappingExecutionOptions,
  ): Promise<cassandra.mapping.Result<Model>>;
}

// below are utility types which are used on Mapper type
type FindDocInfo<
  K,
  C extends string | number | symbol,
> = cassandra.mapping.FindDocInfo & {
  /** The fields you want to retrieve from the database */
  fields: K[];
  /**
   * @note - You can only use ASC | DESC at a time, you can't use both. All keys either
   * have ASC or DESC, but not both at the same time
   *
   * @note - Make sure your clustering keys are in order which matches the order of clustering keys on your table
   */
  orderBy?: Partial<Record<C, 'ASC'>> | Partial<Record<C, 'DESC'>>;
};

type FindDocInfoNoField<C extends string | number | symbol> =
  cassandra.mapping.FindDocInfo & {
    /**
     * If you do not provide this, it means that you will get all the columns on
     * the records
     */
    fields?: undefined;
    /**
     * @note - You can only use ASC | DESC at a time, you can't use both. All keys either
     * have ASC or DESC, but not both at the same time
     *
     * @note - Make sure your clustering keys are in order which matches the order of clustering keys on your table
     */
    orderBy?: Partial<Record<C, 'ASC'>> | Partial<Record<C, 'DESC'>>;
  };

type InsertDocInfo<K extends string | number | symbol> =
  cassandra.mapping.InsertDocInfo & {
    /**
     * Insert only the specified fields regardless of the other properties even
     * if they are provided.
     */
    fields?: K[];
    /**
     * Supports conditional clause for lightweight transactions (CAS) that
     * allows to insert only if the row doesn’t exist. Please note that using IF
     * conditions will incur a non-negligible performance cost on the
     * server-side so this should be used sparingly.
     */
    when?: Record<K, cassandra.mapping.q.QueryOperator>;
  };

type UpdateDocInfo<
  K extends string | number | symbol,
  C extends string | number | symbol,
> = cassandra.mapping.UpdateDocInfo & {
  fields?: K[];
  /**
   * @note - You can only use ASC | DESC at a time, you can't use both. All keys either
   * have ASC or DESC, but not both at the same time
   *
   * @note - Make sure your clustering keys are in order which matches the order of clustering keys on your table
   */
  orderBy?: Partial<Record<C, 'ASC'>> | Partial<Record<C, 'DESC'>>;
  /**
   * Supports conditional clause for lightweight transactions (CAS) that allows
   * to update only if the row exist. Please note that using IF conditions will
   * incur a non-negligible performance cost on the server-side so this should
   * be used sparingly.
   */
  when?: Record<K, cassandra.mapping.q.QueryOperator>;
};

type RemoveDocInfo<K extends string | number | symbol> =
  cassandra.mapping.RemoveDocInfo & {
    /** Fields you want to remove */
    fields?: K[];
    /**
     * Supports conditional clause for lightweight transactions (CAS) that
     * allows to specify the condition that has to be met for the delete to
     * occur. Please note that using IF conditions will incur a non-negligible
     * performance cost on the server-side so this should be used sparingly.
     */
    when?: Record<K, cassandra.mapping.q.QueryOperator>;
  };
`;
