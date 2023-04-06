FROM postgres:latest

COPY dump.sql /docker-entrypoint-initdb.d/

RUN chmod 755 /docker-entrypoint-initdb.d/dump.sql