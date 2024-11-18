package helloworld_test

import (
	"testing"

	hc "github.com/ONSdigital/dp-hello-world-library"
	. "github.com/smartystreets/goconvey/convey"
)

// TODO replace helloworld tests
func TestNewHelloWorld(t *testing.T) {
	Convey("Given a new hello world message", t, func() {
		message := "hello new world!"

		Convey("When NewHelloWorld func is called", func() {
			helloWorld := hc.NewHelloWorld(message)

			Convey("Then HelloWorld object is returned containing new message", func() {
				So(helloWorld, ShouldNotBeNil)
				So(helloWorld, ShouldResemble, &hc.HelloWorld{Message: message})
			})
		})
	})
}
