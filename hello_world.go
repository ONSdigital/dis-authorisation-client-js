// TODO replace helloworld package
package helloworld

type HelloWorld struct {
	Message string
}

func NewHelloWorld(message string) *HelloWorld {
	return &HelloWorld{Message: message}
}
