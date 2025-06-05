export enum Level{
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARNING = "WARNING",
    ERROR = "ERROR"
}

export enum PlatformType {
    console = 'console',
    rest = 'rest',
    loki = 'loki',
    elasticsearch = 'elasticsearch',
    datadog = 'datadog',
}

export enum RestAuthType {
    none="none",
    basic="basic",
    apikey="apikey",
}

export enum ApiKeyMechanismType {
    header="header",
    queryparam="queryparam",
    matrixparam="matrixparam",
}