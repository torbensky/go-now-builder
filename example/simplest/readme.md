# Basic Setup

Just use the Now CLI to deploy from this directory using `now` command.

This example will deploy two routes on Zeit:

- `/hello`
- `/bye`

## Updating vendoring

If you make any import changes, make sure you run `go mod vendor` to update your vendoring *before* you deploy to Zeit. 

Why?

The Now lambda environment is very restricted in disk space. By vendoring on your machine using Go modules, you will assemble the minimal set of dependencies to build your lambdas.

## Want even smaller deploys?

Repeat this project setup and different levels in a "monorepo" and you get more code splitting. If you have one root project, then all dependencies and vendoring are shared.

## What's the `bridge` directory all about

The builder is inspired by the original Zeit Go builder. This is a concept I carried forward from there. It is essentially some Go wrapper code for setting up the lambda execution environment by assembling information that the AWS Lambda API provides. Because we need to do all the vendoring on our side, we need to ensure our project imports this bridge code, which I have hosted in another repository. So we just have an unused import of that code to ensure we get all the vendoring done.

In the future I hope to remove this part of the project setup.