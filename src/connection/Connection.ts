import {Driver} from "../driver/Driver";
import {ConnectionOptions} from "./ConnectionOptions";
import {Repository} from "../repository/Repository";
import {EventSubscriberInterface} from "../subscriber/EventSubscriberInterface";
import {RepositoryNotFoundError} from "./error/RepositoryNotFoundError";
import {EntityMetadata} from "../metadata-builder/metadata/EntityMetadata";
import {SchemaCreator} from "../schema-creator/SchemaCreator";
import {MetadataNotFoundError} from "./error/MetadataNotFoundError";
import {ConstructorFunction} from "../common/ConstructorFunction";
import {EntityListenerMetadata} from "../metadata-builder/metadata/EntityListenerMetadata";
import {EntityManager} from "../repository/EntityManager";

type RepositoryAndMetadata = { repository: Repository<any>, metadata: EntityMetadata };

/**
 * A single connection instance to the database. Each connection has its own repositories, subscribers and metadatas.
 */
export class Connection {

    // -------------------------------------------------------------------------
    // Properties
    // -------------------------------------------------------------------------

    private _name: string;
    private _driver: Driver;
    private _entityMetadatas: EntityMetadata[] = [];
    private _entityListenerMetadatas: EntityListenerMetadata[] = [];
    private _subscribers: EventSubscriberInterface<any>[] = [];
    private repositoryAndMetadatas: RepositoryAndMetadata[] = [];
    private _options: ConnectionOptions;
    private entityManager: EntityManager;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(name: string, driver: Driver, options: ConnectionOptions) {
        this._name = name;
        this._driver = driver;
        this._driver.connection = this;
        this._options = options;
        this.entityManager = new EntityManager(this);
    }

    // -------------------------------------------------------------------------
    // Getter / Setter Methods
    // -------------------------------------------------------------------------

    /**
     * The name of the connection.
     */
    get name(): string {
        return this._name;
    }

    /**
     * Database driver used by this connection.
     */
    get driver(): Driver {
        return this._driver;
    }

    /**
     * All subscribers that are registered for this connection.
     */
    get subscribers(): EventSubscriberInterface<any>[] {
        return this._subscribers;
    }

    /**
     * All entity metadatas that are registered for this connection.
     */
    get entityMetadatas(): EntityMetadata[] {
        return this._entityMetadatas;
    }

    /**
     * All entity listener metadatas that are registered for this connection.
     */
    get entityListeners(): EntityListenerMetadata[] {
        return this._entityListenerMetadatas;
    }

    /**
     * All repositories that are registered for this connection.
     */
    get repositories(): Repository<any>[] {
        return this.repositoryAndMetadatas.map(repoAndMeta => repoAndMeta.repository);
    }

    /**
     * This connection options and settings.
     */
    get options(): ConnectionOptions {
        return this._options;
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Performs connection to the database.
     */
    connect(): Promise<void> {
        const schemaCreator = new SchemaCreator(this);
        return this._driver.connect().then(() => {
            if (this._options.autoSchemaCreate === true)
                return schemaCreator.create();
            
            return undefined;
        });
    }

    /**
     * Closes this connection.
     */
    close(): Promise<void> {
        return this._driver.disconnect();
    }

    /**
     * Gets EntityManager of this connection.
     */
    getEntityManager() {
        return this.entityManager;
    }

    /**
     * Gets repository for the given entity class.
     */
    getRepository<Entity>(entityClass: ConstructorFunction<Entity>|Function): Repository<Entity> {
        const metadata = this.getEntityMetadata(entityClass);
        const repoMeta = this.repositoryAndMetadatas.find(repoMeta => repoMeta.metadata === metadata);
        if (!repoMeta)
            throw new RepositoryNotFoundError(entityClass);

        return repoMeta.repository;
    }

    /**
     * Gets the entity metadata for the given entity class.
     */
    getEntityMetadata(entityClass: Function): EntityMetadata {
        const metadata = this.entityMetadatas.find(metadata => metadata.target === entityClass);
        if (!metadata)
            throw new MetadataNotFoundError(entityClass);

        return metadata;
    }

    /**
     * Registers entity metadatas for the current connection.
     */
    addEntityMetadatas(metadatas: EntityMetadata[]): Connection {
        this._entityMetadatas = this._entityMetadatas.concat(metadatas);
        this.repositoryAndMetadatas = this.repositoryAndMetadatas.concat(metadatas.map(metadata => this.createRepoMeta(metadata)));
        return this;
    }

    /**
     * Registers entity listener metadatas for the current connection.
     */
    addEntityListenerMetadatas(metadatas: EntityListenerMetadata[]): Connection {
        this._entityListenerMetadatas = this._entityListenerMetadatas.concat(metadatas);
        return this;
    }

    /**
     * Registers subscribers for the current connection.
     */
    addSubscribers(subscribers: EventSubscriberInterface<any>[]): Connection {
        this._subscribers = this._subscribers.concat(subscribers);
        return this;
    }

    // -------------------------------------------------------------------------
    // Private Methods
    // -------------------------------------------------------------------------

    private createRepoMeta(metadata: EntityMetadata): RepositoryAndMetadata {
        return {
            metadata: metadata,
            repository: new Repository<any>(this, metadata)
        };
    }

}