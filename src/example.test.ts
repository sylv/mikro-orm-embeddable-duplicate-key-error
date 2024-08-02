import {
  Embeddable,
  Embedded,
  Entity,
  ManyToOne,
  MikroORM,
  PrimaryKey,
  Property,
  Ref,
} from "@mikro-orm/sqlite";

@Embeddable()
export class Metadata {
  // changing this to anything else makes it work, so it seems to be caused
  // by the parent entity having a property with the same name
  @Property({ nullable: true })
  author?: string;
}

@Entity()
export class UserEntity {
  @PrimaryKey()
  id!: number;

  @Property()
  private!: boolean;
}

@Entity()
export class PostEntity {
  @PrimaryKey()
  id!: number;

  // "object: true" is necessary, otherwise it works fine
  @Embedded(() => Metadata, { nullable: true, object: true })
  meta?: Metadata;

  @ManyToOne(() => UserEntity, { ref: true })
  author!: Ref<UserEntity>;
}

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ":memory:",
    entities: [UserEntity, PostEntity],
    debug: ["query", "query-params"],
    allowGlobalContext: true, // only for testing
  });
  await orm.schema.refreshDatabase();
});

afterAll(async () => {
  await orm.close(true);
});

test("Embeddables erroring with duplicate property names", async () => {
  const user = orm.em.create(UserEntity, { private: false });
  orm.em.create(PostEntity, {
    author: user,
    meta: { author: "opengraph_author" },
  });

  await orm.em.flush();
  orm.em.clear();

  // this would throw "Invalid query condition: { author: { 'author.private': false } }"
  await orm.em
    .getRepository(PostEntity)
    .createQueryBuilder()
    .select("*")
    // removing this caused it to throw "TypeError: Cannot read properties of undefined (reading '0')"
    .leftJoinAndSelect("author", "author")
    .where({
      author: { private: false },
    })
    .getSingleResult();
});
