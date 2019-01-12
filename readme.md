# Why another Zeit Now Go builder

The official builder is an alpha and has several limitations that have made it impossible for me to build some projects. After trying a few tweaks to that builder, I felt that there was an opportunity for a new builder that would handle the type of projects I build as a Go developer.

The builder takes advantage of Go Modules to do dependency management. This greatly improves the efficiency of the dependency installation. If an existing `vendor` directory is found the builder will use that.

This builder expects a Go project with a source layout *like* this, with some configurability:
```
{go-project-root}/
                    now.json
                    vendor/
                    {pathTo:go.mod} <-- entrypoint path should be to this
                    {lambdaBaseDir}/**/ <-- configurable builder property
                                        {lambdaFileName} <-- configurable builder property
```

## Configurable properties

- `lambdaBaseDir`: Defaults to `{go-project-root}/cmd`. This is the directory where the builder searches for lambdas. Higher level directories or other sibling directories will not be searched. This is because the builder needs to do some funky stuff to use a "bridge" and connect it with some Now middleware.
- `lambdaFileName`: Defaults to `lambda.go`. `.go` source files with a matching name will be considered lambdas by this builder.
- `maxLambdaSize`: See Zeit documentation. Standard builder property.

Note: `go-project-root` refers to that path within your Now project that is the root of your Go source for a given entrypoint. It should contain a `go.mod` file.

## Entrypoint

The entrypoint is a path to `go.mod`

The entrypoint for this builder is the path to a `go.mod` file. Your Go source should be organized like a typical Go modules project. This means having a `vendor` directory in the top level of your Go source next to a Go modules `go.mod` (the entrypoint for this builder).

## Internal library code

This is any package path you want. Just do typical go things.

## Dependencies

Any external dependencies should be included locally in your project using the `go mod vendor`. If you are working in `$GOPATH` you need to set the `GO111MODULE=on` environment before running that command. This builder will warn if no vendor directory is found, but it is safe to ignore that warning if you don't have any external dependencies.